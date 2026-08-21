import { useEffect, useState } from "react";
import { fetchConfig } from "../lib/config";

export function ConfigPage() {
  const [raw, setRaw] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig()
      .then((c) => setRaw(JSON.stringify(c, null, 2)))
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setErr(null);
    setSaved(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setErr(`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const r = await fetch("/panel/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (!r.ok) {
      setErr(`保存失败 HTTP ${r.status}: ${await r.text()}`);
      return;
    }
    setSaved("已保存。需要重启 sing-box 生效。");
  }

  return (
    <div>
      <h1>配置</h1>
      <div className="toolbar">
        <button className="btn primary" onClick={save} disabled={loading}>保存</button>
        {saved && <span className="chip ok">{saved}</span>}
        {err && <span className="chip err">{err}</span>}
      </div>
      <textarea
        className="mono"
        style={{ width: "100%", minHeight: "60vh", background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, fontSize: 12 }}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
