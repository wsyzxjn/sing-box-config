import { useEffect, useRef, useState } from "react";
import { useLogs } from "../lib/hooks";
import { LogLevel } from "../gen/daemon/started_service_pb";

const label: Record<number, string> = {
  [LogLevel.PANIC]: "PANIC",
  [LogLevel.FATAL]: "FATAL",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.TRACE]: "TRACE",
};

export function LogsPage() {
  const { lines, clear } = useLogs(2000);
  const [follow, setFollow] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (follow && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
  }, [lines.length, follow]);

  return (
    <div>
      <h1>日志</h1>
      <div className="toolbar">
        <label className="pill faint"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 跟随</label>
        <button className="btn" onClick={() => clear()}>清空</button>
      </div>
      <div className="card" style={{ maxHeight: "70vh", overflow: "auto" }}>
        {lines.map((l, i) => (
          <div key={i} className={`log-line ${l.level === LogLevel.ERROR || l.level === LogLevel.FATAL || l.level === LogLevel.PANIC ? "err" : l.level === LogLevel.WARN ? "warn" : l.level === LogLevel.DEBUG || l.level === LogLevel.TRACE ? "debug" : ""}`}>
            [{label[l.level] ?? l.level}] {l.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
