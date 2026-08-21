import { useMemo, useState } from "react";
import { fmtBytes, parseSource } from "../lib/api";
import { useConnections } from "../lib/hooks";
import { getClient } from "../lib/api";

export function ConnectionsPage() {
  const { rows } = useConnections();
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const client = getClient();

  const list = useMemo(() => {
    const arr = [...rows.values()];
    arr.sort((a, b) => b.updatedAt - a.updatedAt);
    return arr.filter((r) => {
      if (onlyOpen && r.closedAt) return false;
      if (!q) return true;
      const c = r.conn;
      const hay = [c.domain, c.destination, c.source, c.outbound, c.rule, c.inbound, c.protocol]
        .join(" ")
        .toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [rows, q, onlyOpen]);

  return (
    <div>
      <h1>连接</h1>
      <div className="toolbar">
        <input type="search" placeholder="域名 / 出口 / 规则 / 来源 IP" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
        <label className="pill faint">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 仅活跃
        </label>
        <button
          className="btn"
          onClick={() => {
            if (confirm("关闭全部连接？")) void client.closeAllConnections({}).catch(() => undefined);
          }}
        >
          全部关闭
        </button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>域名</th>
              <th>目的</th>
              <th>来源</th>
              <th>入站</th>
              <th>规则</th>
              <th>出口</th>
              <th>上行</th>
              <th>下行</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 300).map(({ conn: c, uplinkDelta, downlinkDelta }) => {
              const src = parseSource(c.source);
              return (
                <tr key={c.id}>
                  <td className="mono">{c.domain || "-"}</td>
                  <td className="mono">{c.destination}</td>
                  <td className="mono">{src.ip}</td>
                  <td>{c.inboundType}</td>
                  <td className="mono">{c.rule || "-"}</td>
                  <td>{c.outbound}</td>
                  <td className="mono">{fmtBytes(Number(uplinkDelta))}</td>
                  <td className="mono">{fmtBytes(Number(downlinkDelta))}</td>
                  <td className="row-actions">
                    <button
                      className="btn small danger"
                      onClick={() => void client.closeConnection({ id: c.id }).catch(() => undefined)}
                    >
                      关
                    </button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="faint" style={{ textAlign: "center", padding: 24 }}>
                  暂无连接
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="faint" style={{ marginTop: 8 }}>共 {list.length} 条</div>
    </div>
  );
}
