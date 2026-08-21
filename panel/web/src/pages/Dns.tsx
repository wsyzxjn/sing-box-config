import { useEffect, useState } from "react";
import { fetchConfig, type SingBoxConfig } from "../lib/config";

export function DnsPage() {
  const [cfg, setCfg] = useState<SingBoxConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig().then(setCfg).catch((e) => setErr(e.message || String(e)));
  }, []);

  const dns = cfg?.dns;
  return (
    <div>
      <h1>DNS</h1>
      {err && <div className="card">读取失败：{err}</div>}
      <h2>服务器</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>tag</th><th>类型</th><th>服务器</th></tr></thead>
          <tbody>
            {(dns?.servers || []).map((s) => (
              <tr key={s.tag}><td className="mono">{s.tag}</td><td>{s.type}</td><td className="mono">{String(s.server ?? "")}</td></tr>
            ))}
            {(dns?.servers || []).length === 0 && <tr><td colSpan={3} className="faint" style={{ textAlign: "center" }}>无</td></tr>}
          </tbody>
        </table>
      </div>
      <h2>规则</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>匹配</th><th>动作</th></tr></thead>
          <tbody>
            {(dns?.rules || []).map((r, i) => (
              <tr key={i}>
                <td className="faint mono">{i + 1}</td>
                <td className="mono">{Object.keys(r).filter((k) => !["action", "server"].includes(k)).join(" ") || "(默认)"}</td>
                <td className="mono">{String((r as { server?: string; action?: string }).server ?? (r as { action?: string }).action ?? "")}</td>
              </tr>
            ))}
            {(dns?.rules || []).length === 0 && <tr><td colSpan={3} className="faint" style={{ textAlign: "center" }}>无</td></tr>}
          </tbody>
        </table>
      </div>
      <h2>最终</h2>
      <div className="card mono">{String(dns?.final ?? "-")}</div>
    </div>
  );
}
