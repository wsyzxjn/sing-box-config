import { useEffect, useState } from "react";
import { fetchClashRules } from "../lib/config";

interface ClashRule {
  type: string;
  payload: string;
  proxy: string;
}

export function RulesPage() {
  const [rules, setRules] = useState<ClashRule[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchClashRules()
      .then((r) => setRules(r.rules || []))
      .catch((e) => setErr(e.message || String(e)));
  }, []);

  const shown = q
    ? rules.filter((r) => `${r.type} ${r.payload} ${r.proxy}`.toLowerCase().includes(q.toLowerCase()))
    : rules;

  return (
    <div>
      <h1>规则</h1>
      <div className="toolbar">
        <input type="search" placeholder="过滤 rule_set / 域名 / 出口" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="faint">{shown.length} / {rules.length} 条</span>
      </div>
      {err && <div className="card">读取失败：{err}</div>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>匹配</th><th>出口</th></tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                <td className="faint mono">{i + 1}</td>
                <td className="mono">{r.payload || <span className="faint">(默认)</span>}</td>
                <td>{r.proxy}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={3} className="faint" style={{ textAlign: "center", padding: 24 }}>没有规则</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
