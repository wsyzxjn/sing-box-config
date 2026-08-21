import { useEffect, useMemo, useState } from "react";
import { getClient, fmtBytes, fmtRate } from "../lib/api";
import { useStatus } from "../lib/hooks";

export function OverviewPage() {
  const { status, error } = useStatus(1000);
  const [version, setVersion] = useState<string>("-");
  const [apiVersion, setApiVersion] = useState<number>(0);
  const [mode, setMode] = useState<string>("-");
  const [modeList, setModeList] = useState<string[]>([]);

  useEffect(() => {
    const c = getClient();
    c.getVersion({}).then((v) => {
      setVersion(v.version);
      setApiVersion(v.apiVersion);
    }).catch(() => undefined);
    c.getClashModeStatus({}).then((m) => {
      setMode(m.currentMode || "-");
      setModeList(m.modeList);
    }).catch(() => undefined);
  }, []);

  const mem = useMemo(() => {
    if (!status) return "-";
    return fmtBytes(Number((status as { memory: bigint | number }).memory as bigint));
  }, [status]);

  return (
    <div>
      <h1>概览</h1>
      {error && <div className="card">连接失败：{error.message}</div>}
      <div className="grid stats">
        <div className="card"><div className="stat-label">内核</div><div className="stat-value">{version}</div><div className="faint">API v{apiVersion}</div></div>
        <div className="card"><div className="stat-label">Clash Mode</div><div className="stat-value">{mode}</div><div className="faint">{modeList.join(" / ") || "-"}</div></div>
        <div className="card"><div className="stat-label">上行</div><div className="stat-value">{status ? fmtRate(Number(status.uplink)) : "-"}</div><div className="faint">总 {status ? fmtBytes(Number(status.uplinkTotal)) : "-"}</div></div>
        <div className="card"><div className="stat-label">下行</div><div className="stat-value">{status ? fmtRate(Number(status.downlink)) : "-"}</div><div className="faint">总 {status ? fmtBytes(Number(status.downlinkTotal)) : "-"}</div></div>
        <div className="card"><div className="stat-label">内存</div><div className="stat-value">{mem}</div><div className="faint">goroutines {status?.goroutines ?? "-"}</div></div>
        <div className="card"><div className="stat-label">连接</div><div className="stat-value">{status?.connectionsIn ?? "-"} / {status?.connectionsOut ?? "-"}</div><div className="faint">入 / 出</div></div>
      </div>
    </div>
  );
}
