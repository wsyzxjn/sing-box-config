import { useEffect, useState } from "react";
import { fetchConfig, fetchRuleSet, refreshRuleSets, restartCore, type RuleSetEntry } from "../lib/config";

function flatten(rules: Record<string, unknown>[]): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  for (const r of rules || []) {
    for (const [k, v] of Object.entries(r)) {
      out.push({ k, v: Array.isArray(v) ? v.join(", ") : String(v) });
    }
  }
  return out;
}

export function RuleSetsPage() {
  const [sets, setSets] = useState<RuleSetEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchConfig()
      .then((c) => {
        const route = c.route?.rule_set ?? [];
        setSets(route);
      })
      .catch((e) => setErr(e.message || String(e)));
  }, []);

  async function toggle(tag: string) {
    if (expanded === tag) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(tag);
    setLoading(tag);
    setDetail(null);
    try {
      const data = await fetchRuleSet(tag);
      setDetail(data as unknown as Record<string, unknown>);
    } catch (e) {
      setDetail({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <h1>规则集</h1>
      <div className="toolbar">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refreshRuleSets();
              location.reload();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "刷新中…" : "立即更新远端规则集"}
        </button>
        <button
          className="btn"
          onClick={async () => {
            if (!confirm("重启 sing-box？会短暂断网")) return;
            await restartCore();
            setTimeout(() => location.reload(), 3000);
          }}
        >
          重启内核
        </button>
      </div>
      {err && <div className="card">读取失败：{err}</div>}
      {sets.length === 0 && !err && <div className="card faint">没有规则集，或配置里不是 route.rule_set。</div>}
      {sets.map((s) => (
        <div key={s.tag} className="card" style={{ marginBottom: 10 }}>
          <div className="group-head" style={{ cursor: "pointer" }} onClick={() => toggle(s.tag)}>
            <div className="group-title mono">{s.tag}</div>
            <span className="chip">{s.type}</span>
            {s.format && <span className="chip">{s.format}</span>}
            <span className="faint mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.url || s.path || ""}</span>
          </div>
          {expanded === s.tag && (
            <div>
              {loading === s.tag && <div className="faint">解析中…</div>}
              {detail && detail.error && <div className="chip err">{String(detail.error)}</div>}
              {detail && !detail.error && Array.isArray((detail as { rules?: unknown }).rules) && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>字段</th><th>值</th></tr></thead>
                    <tbody>
                      {flatten((detail as { rules: Record<string, unknown>[] }).rules).slice(0, 200).map((r, i) => (
                        <tr key={i}><td className="mono faint">{r.k}</td><td className="mono">{r.v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="faint" style={{ marginTop: 8 }}>仅显示前 200 项</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
