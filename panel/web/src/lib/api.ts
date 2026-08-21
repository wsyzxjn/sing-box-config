import { createClient, type Client } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import {
  StartedService,
  type Connection,
  type ConnectionEvent,
  type Group,
  type LogLevel,
  type Status,
} from "../gen/daemon/started_service_pb";

// The panel is served by the same sing-box API listener (or the Go sidecar).
// Connection settings can be overridden from the setup page and are stored
// in localStorage.
export interface ServerConfig {
  url: string;
  secret: string;
}

const STORAGE_KEY = "sb-panel:server";

export function defaultServer(): ServerConfig {
  // served by the sidecar; proxy grpc-web to the native API on this origin
  return { url: window.location.origin, secret: "" };
}

export function loadServer(): ServerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultServer();
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
      url: typeof parsed.url === "string" && parsed.url ? parsed.url : defaultServer().url,
      secret: typeof parsed.secret === "string" ? parsed.secret : "",
    };
  } catch {
    return defaultServer();
  }
}

export function saveServer(cfg: ServerConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

let cached: { base: string; client: Client<typeof StartedService> } | null = null;

export function getClient(): Client<typeof StartedService> {
  const { url, secret } = loadServer();
  const base = url.trim().replace(/\/+$/, "");
  if (cached && cached.base === `${base}\0${secret}`) return cached.client;
  const transport = createGrpcWebTransport({
    baseUrl: base,
    interceptors: [
      (next) => async (req) => {
        req.header.set("X-Language", "zh-CN");
        req.header.set("Accept-Language", "zh");
        if (secret) req.header.set("Authorization", `Bearer ${secret}`);
        return next(req);
      },
    ],
  });
  cached = { base: `${base}\0${secret}`, client: createClient(StartedService, transport) };
  return cached.client;
}

export { LogLevel };
export type { Connection, ConnectionEvent, Group, Status };

export function fmtBytes(n: number | bigint): string {
  const v = typeof n === "bigint" ? Number(n) : n;
  if (!Number.isFinite(v)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let x = Math.abs(v);
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtRate(n: number): string {
  return `${fmtBytes(n)}/s`;
}

export function fmtMs(ms: number): string {
  if (ms <= 0) return "";
  return `${ms} ms`;
}

export function parseSource(addr: string): { ip: string; port: string } {
  const i = addr.lastIndexOf(":");
  if (i < 0) return { ip: addr, port: "" };
  return { ip: addr.slice(0, i), port: addr.slice(i + 1) };
}
