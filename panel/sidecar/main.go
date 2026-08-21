// sb-panel-sidecar exposes what the official sing-box API does not:
// the built React panel, running config read/write, rule-set inspection
// (decompiling .srs on demand), a /rules proxy to Clash API, and restart.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

var (
	flagListen = getenv("PANEL_LISTEN", "0.0.0.0:9096")
	flagConfig = getenv("PANEL_CONFIG", "/etc/sing-box/config.json")
	flagClash  = getenv("PANEL_CLASH", "http://127.0.0.1:9090")
	flagAPI    = getenv("PANEL_API", "http://127.0.0.1:9095")
	flagUI     = getenv("PANEL_UI", "./dist")
	flagSB     = getenv("PANEL_SB", "/usr/bin/sing-box")
	restarting atomic.Bool
)

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	http.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	http.HandleFunc("/panel/config", cors(configHandler))
	http.HandleFunc("/panel/rulesets/", cors(ruleSetDetailHandler))
	http.HandleFunc("/panel/restart", cors(restartHandler))
	http.Handle("/daemon.StartedService/", grpcWebProxy())
	http.Handle("/panel/clash/", http.StripPrefix("/panel/clash", corsHandler(clashProxy())))
	serveSPA()

	log.Printf("listening on %s (config=%s clash=%s api=%s ui=%s)", flagListen, flagConfig, flagClash, flagAPI, flagUI)
	log.Fatal(http.ListenAndServe(flagListen, nil))
}

func cors(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		if rh := r.Header.Get("Access-Control-Request-Headers"); rh != "" {
			w.Header().Set("Access-Control-Allow-Headers", rh)
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}

func corsHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func clashProxy() http.Handler {
	target, err := url.Parse(flagClash)
	if err != nil {
		return http.NotFoundHandler()
	}
	return &httputil.ReverseProxy{Director: func(r *http.Request) {
		r.URL.Scheme = target.Scheme
		r.URL.Host = target.Host
		r.Host = target.Host
	}}
}

// grpcWebProxy forwards /daemon.* to the official sing-box API listener.
// Same-origin from the panel removes the need for CORS preflights.
func grpcWebProxy() http.Handler {
	target, err := url.Parse(flagAPI)
	if err != nil {
		return http.NotFoundHandler()
	}
	return &httputil.ReverseProxy{Director: func(r *http.Request) {
		r.URL.Scheme = target.Scheme
		r.URL.Host = target.Host
		r.Host = target.Host
	}}
}

func configHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(flagConfig)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(data)
	case http.MethodPut:
		body, err := io.ReadAll(io.LimitReader(r.Body, 8<<20))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var v any
		if err := json.Unmarshal(body, &v); err != nil {
			http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}
		pretty, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		pretty = append(pretty, '\n')
		tmp := flagConfig + ".panel-tmp"
		if err := os.WriteFile(tmp, pretty, 0o644); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if _, statErr := os.Stat(flagSB); !os.IsNotExist(statErr) {
			cmd := exec.Command(flagSB, "check", "-c", tmp)
			out, err2 := cmd.CombinedOutput()
			if err2 != nil {
				_ = os.Remove(tmp)
				http.Error(w, "sing-box check failed: "+string(out), http.StatusBadRequest)
				return
			}
		}
		if err := os.Rename(tmp, flagConfig); err != nil {
			_ = os.Remove(tmp)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func ruleSetDetailHandler(w http.ResponseWriter, r *http.Request) {
	tag := strings.TrimPrefix(r.URL.Path, "/panel/rulesets/")
	if tag == "" || strings.Contains(tag, "..") || strings.Contains(tag, "/") {
		http.Error(w, "bad tag", http.StatusBadRequest)
		return
	}
	cfgRaw, err := os.ReadFile(flagConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	var cfg struct {
		Route struct {
			RuleSet []struct {
				Tag     string `json:"tag"`
				Format  string `json:"format"`
				Path    string `json:"path"`
				URL     string `json:"url"`
				Initial string `json:"initial_path"`
			} `json:"rule_set"`
		} `json:"route"`
	}
	if err := json.Unmarshal(cfgRaw, &cfg); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var path, format, remote string
	for i := range cfg.Route.RuleSet {
		rs := cfg.Route.RuleSet[i]
		if rs.Tag != tag {
			continue
		}
		format = rs.Format
		remote = rs.URL
		path = rs.Path
		if path == "" {
			path = rs.Initial
		}
		break
	}
	if path == "" {
		http.Error(w, "rule-set has no local file", http.StatusNotFound)
		return
	}
	var raw []byte
	if format == "binary" {
		tmp, err := os.CreateTemp("", "ruleset-*.json")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		outPath := tmp.Name()
		_ = tmp.Close()
		defer os.Remove(outPath)
		cmd := exec.Command(flagSB, "rule-set", "decompile", path, "-o", outPath)
		out, err := cmd.CombinedOutput()
		if err != nil {
			http.Error(w, "decompile failed: "+string(out), http.StatusInternalServerError)
			return
		}
		raw, err = os.ReadFile(outPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		b, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		raw = b
	}
	var js struct {
		Version int              `json:"version"`
		Rules   []map[string]any `json:"rules"`
	}
	if err := json.Unmarshal(raw, &js); err != nil {
		http.Error(w, "ruleset JSON invalid: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"tag":       tag,
		"format":    format,
		"path":      path,
		"url":       remote,
		"version":   js.Version,
		"ruleCount": len(js.Rules),
		"rules":     js.Rules,
	})
}

func restartHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !restarting.CompareAndSwap(false, true) {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	defer restarting.Store(false)

	var out string
	for _, cmdline := range [][]string{
		{"/etc/init.d/sing-box", "restart"},
		{"service", "sing-box", "restart"},
	} {
		c := exec.Command(cmdline[0], cmdline[1:]...)
		b, err := c.CombinedOutput()
		out = string(b)
		if err == nil {
			time.Sleep(2 * time.Second)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	http.Error(w, "restart failed: "+out, http.StatusInternalServerError)
}

func serveSPA() {
	var root fs.FS
	if st, err := os.Stat(flagUI); err == nil && st.IsDir() {
		root = os.DirFS(flagUI)
	} else {
		root = os.DirFS("dist")
	}
	index, err := fs.ReadFile(root, "index.html")
	if err != nil {
		index = []byte("<h1>panel not built</h1>")
	}
	fileServer := http.FileServer(http.FS(root))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(index)
			return
		}
		clean := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		if _, err := root.Open(clean); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(index)
	})
}

var _ = bytes.MinRead
var _ = fmt.Sprint
