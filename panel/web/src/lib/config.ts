// Fetch the running sing-box config through the Clash API proxy exposed by
// the sidecar (/panel/clash/...), falling back to the JSON the sidecar also
// exposes from /panel/config. Used for rules / rule-sets / DNS pages, which
// the native API does not provide.

export interface RouteRule {
  [key: string]: unknown;
}

export interface RuleSetEntry {
  tag: string;
  type: string;
  format?: string;
  path?: string;
  url?: string;
  update_interval?: string;
  [key: string]: unknown;
}

export interface SingBoxConfig {
  route?: {
    rules?: RouteRule[];
    rule_set?: RuleSetEntry[];
    default_domain_resolver?: unknown;
    final?: string;
  };
  dns?: {
    servers?: { tag: string; type: string; server?: string }[];
    rules?: RouteRule[];
    final?: string;
    rulesets?: RuleSetEntry[];
  };
  [key: string]: unknown;
}

export async function fetchClashRules(): Promise<{ rules: { type: string; payload: string; proxy: string }[] }> {
  const r = await fetch("/panel/clash/rules");
  if (!r.ok) throw new Error(`rules http ${r.status}`);
  return r.json();
}

export async function fetchConfig(): Promise<SingBoxConfig> {
  const r = await fetch("/panel/config");
  if (!r.ok) throw new Error(`config http ${r.status}`);
  return r.json();
}

export async function fetchRuleSet(name: string): Promise<{ version: number; rules: Record<string, unknown>[] }> {
  const r = await fetch(`/panel/rulesets/${encodeURIComponent(name)}`);
  if (!r.ok) throw new Error(`ruleset ${name} http ${r.status}`);
  return r.json();
}

export async function refreshRuleSets(): Promise<void> {
  await fetch("/panel/refresh", { method: "POST" }).catch(() => undefined);
}

export async function restartCore(): Promise<void> {
  await fetch("/panel/restart", { method: "POST" }).catch(() => undefined);
}
