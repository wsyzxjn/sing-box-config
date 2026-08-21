import { useState } from "react";
import { getClient, fmtMs } from "../lib/api";
import { useGroups } from "../lib/hooks";
import type { Group } from "../gen/daemon/started_service_pb";

export function GroupsPage() {
  const { groups, loaded, error } = useGroups();
  const [testing, setTesting] = useState<string | null>(null);

  const client = getClient();

  async function select(g: Group, outbound: string) {
    await client.selectOutbound({ groupTag: g.tag, outboundTag: outbound }).catch(() => undefined);
  }
  async function urlTest(g: Group) {
    setTesting(g.tag);
    try {
      await client.uRLTest({ outboundTag: g.tag });
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setTesting(null), 800);
    }
  }

  return (
    <div>
      <h1>代理组</h1>
      {error && <div className="card">连接失败：{error.message}</div>}
      {!loaded && <div className="card faint">加载中…</div>}
      {groups.map((g) => (
        <div className="card group" key={g.tag}>
          <div className="group-head">
            <div className="group-title">{g.tag}</div>
            <div className="chip">{g.type}</div>
            <div className="group-meta">当前 {g.selected || "-"}</div>
            <div style={{ flex: 1 }} />
            {g.selectable && (
              <button className="btn small" disabled={testing === g.tag} onClick={() => urlTest(g)}>
                {testing === g.tag ? "测速中…" : "URL 测试"}
              </button>
            )}
          </div>
          <div className="outbound">
            {g.items.map((it) => {
              const delay = it.urlTestDelay;
              const sel = g.selected === it.tag;
              return (
                <div
                  key={it.tag}
                  className={`outbound-item${sel ? " selected" : ""}`}
                  onClick={() => g.selectable && select(g, it.tag)}
                  title={it.tag}
                >
                  <div className="outbound-tag">{it.tag}</div>
                  <div className="outbound-sub">
                    <span className="chip">{it.type}</span>
                    <span className={delay > 0 ? "chip ok" : "chip"}>{fmtMs(delay)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
