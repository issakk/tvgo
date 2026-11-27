// Reads a TVBox-compatible configuration document into the app's model.
import type { ConfigDoc, LiveSource, ParseSource, SiteConfig } from "../types";
import { messageOf, parseLooseJson, resolveUrl } from "./http";

/** Parses a configuration document; `baseUrl` resolves the relative endpoints it names. */
export function parseConfigDocument(text: string, baseUrl: string): ConfigDoc {
  let raw: unknown;
  try {
    raw = parseLooseJson(text);
  } catch (error) {
    throw new Error(`配置文件不是 JSON：${messageOf(error)}`);
  }
  const root = (raw ?? {}) as Record<string, unknown>;
  const sites = readSites(root, baseUrl);
  if (sites.length === 0) throw new Error("配置中没有可用的站点");
  return {
    name: String(root.name ?? root.title ?? ""),
    sites,
    lives: readLives(root, baseUrl),
    parses: readParses(root, baseUrl),
    flags: Array.isArray(root.flags) ? root.flags.map((flag) => String(flag)) : [],
  };
}

function readSites(root: Record<string, unknown>, baseUrl: string): SiteConfig[] {
  const list = Array.isArray(root.sites) ? (root.sites as unknown[]) : [];
  const sites: SiteConfig[] = [];
  for (const value of list) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const api = resolveUrl(String(item.api ?? item.url ?? ""), baseUrl);
    if (!api) continue;
    const name = String(item.name ?? item.key ?? "").trim();
    const key = String(item.key ?? name ?? api).trim();
    sites.push({
      key: key || api,
      name: name || key || api,
      type: readSiteType(item, api),
      api,
      searchable: item.searchable === 0 || item.searchable === "0" ? 0 : 1,
      hide: Number(item.hide ?? 0) ? 1 : 0,
      ext: readExt(item.ext),
    });
  }
  return sites;
}

/** The site's kind: what it declares, or what its endpoint tells. */
function readSiteType(item: Record<string, unknown>, api: string): number {
  const declared = Number(item.type);
  if (Number.isFinite(declared) && declared >= 0) return declared;
  if (api.startsWith("csp_")) return 3;
  if (/\.(jar|js|py|apk)(\?|$)/i.test(api)) return 3;
  return 1;
}

function readExt(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function readLives(root: Record<string, unknown>, baseUrl: string): LiveSource[] {
  const list = Array.isArray(root.lives) ? (root.lives as unknown[]) : [];
  const lives: LiveSource[] = [];
  for (const value of list) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const url = resolveUrl(String(item.url ?? ""), baseUrl);
    if (!url) continue;
    const type = Number(item.type ?? 0);
    lives.push({ name: String(item.name ?? "直播"), url, type: Number.isFinite(type) ? type : 0 });
  }
  return lives;
}

function readParses(root: Record<string, unknown>, baseUrl: string): ParseSource[] {
  const list = Array.isArray(root.parses) ? (root.parses as unknown[]) : [];
  const parses: ParseSource[] = [];
  for (const value of list) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const url = resolveUrl(String(item.url ?? ""), baseUrl);
    if (!url) continue;
    const type = Number(item.type ?? 0);
    parses.push({ name: String(item.name ?? "解析"), url, type: Number.isFinite(type) ? type : 0 });
  }
  return parses;
}
