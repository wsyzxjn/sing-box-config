import { useEffect, useRef, useState } from "react";
import { getClient, type ConnectionEvent, type Group, type Status } from "./api";
import {
  ConnectionEventType,
  SubscribeConnectionsRequestSchema,
  type Connection,
  type LogLevel,
} from "../gen/daemon/started_service_pb";
import { create } from "@bufbuild/protobuf";

const SUB_INTERVAL = 1_000_000_000n;

export function useAbortOnUnmount(): AbortSignal {
  // managed by the calling stream effect; returned when component unmounts
  const ref = useRef<AbortController>();
  if (ref.current === undefined) ref.current = new AbortController();
  useEffect(() => () => ref.current?.abort(), []);
  return ref.current.signal;
}

export function useStatus(interval = 1000) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const client = getClient();
    setError(null);
    const stream = client.subscribeStatus({ interval: BigInt(interval) * 1_000_000n });
    const reader = stream;
    let cancelled = false;
    (async () => {
      try {
        for await (const s of reader) {
          if (cancelled) return;
          setStatus(s);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    })();
    return () => {
      cancelled = true;
      // @ts-expect-error connect stream aborts on return of iterator via finally
      reader.return?.();
    };
  }, [interval]);
  return { status, error };
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const client = getClient();
    setLoaded(false);
    setError(null);
    const stream = client.subscribeGroups({});
    let cancelled = false;
    (async () => {
      try {
        for await (const g of stream) {
          setGroups(g.group);
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    })();
    return () => {
      cancelled = true;
      // @ts-expect-error close stream on unmount
      stream.return?.();
    };
  }, []);
  return { groups, loaded, error };
}

export interface ConnRow {
  conn: Connection;
  uplinkDelta: number;
  downlinkDelta: number;
  closedAt: number | null;
  updatedAt: number;
}

export function useConnections() {
  const [rows, setRows] = useState<Map<string, ConnRow>>(new Map());
  const [lastReset, setLastReset] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const client = getClient();
    setError(null);
    const req = create(SubscribeConnectionsRequestSchema, { interval: SUB_INTERVAL });
    const stream = client.subscribeConnections(req);
    let cancelled = false;
    (async () => {
      try {
        for await (const events of stream) {
          if (cancelled) return;
          setRows((prev) => {
            const next = events.reset ? new Map() : new Map(prev);
            for (const ev of events.events as ConnectionEvent[]) {
              const id = ev.id;
              if (ev.type === ConnectionEventType.CLOSED) {
                const old = next.get(id);
                if (old) {
                  next.set(id, {
                    ...old,
                    conn: {
                      ...old.conn,
                      uplinkTotal: Number(old.conn.uplinkTotal) + grpcToJsIntegerValue(ev.uplinkDelta),
                      downlinkTotal:
                        Number(old.conn.downlinkTotal) + grpcToJsIntegerValue(ev.downlinkDelta),
                      closedAt: Number(ev.closedAt),
                    } as Connection,
                    closedAt: Number(ev.closedAt),
                    uplinkDelta: 0,
                    downlinkDelta: 0,
                    updatedAt: Date.now(),
                  });
                }
                continue;
              }
              if (!ev.connection) continue;
              next.set(id, {
                conn: ev.connection,
                uplinkDelta: grpcToJsIntegerValue(ev.uplinkDelta),
                downlinkDelta: grpcToJsIntegerValue(ev.downlinkDelta),
                closedAt: null,
                updatedAt: Date.now(),
              });
            }
            return next;
          });
          if (events.reset) setLastReset(Date.now());
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    })();
    return () => {
      cancelled = true;
      // @ts-expect-error close stream on unmount
      stream.return?.();
    };
  }, []);
  return { rows, lastReset, error };
}

function grpcToJsIntegerValue(v: bigint | number | undefined): number {
  if (v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  return v;
}

export interface LogLine {
  level: LogLevel;
  message: string;
  ts: number;
}

export function useLogs(max = 2000) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const clearRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const client = getClient();
    setError(null);
    const stream = client.subscribeLog({});
    let cancelled = false;
    (async () => {
      try {
        for await (const batch of stream) {
          if (cancelled) return;
          setLines((prev) => {
            const added = batch.messages.map((m) => ({
              level: m.level,
              message: m.message.replace(/\033\[[0-9;]*m/g, ""),
              ts: Date.now(),
            }));
            const next = batch.reset ? added : prev.concat(added);
            return next.length > max ? next.slice(next.length - max) : next;
          });
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    })();
    clearRef.current = () => {
      void client.clearLogs({}).catch(() => undefined);
      setLines([]);
    };
    return () => {
      cancelled = true;
      // @ts-expect-error close stream on unmount
      stream.return?.();
    };
  }, [max]);
  return { lines, clear: clearRef, error };
}
