// Reads a TVBox-compatible configuration document into the app's model.
import type { ConfigDoc, ConfigRepo, LiveSource, ParseSource, SiteConfig } from "../types";
import { messageOf, parseLooseJson, resolveUrl } from "./http";

/** Parses a configuration document; `baseUrl` resolves the relative endpoints it names. */
export function parseConfigDocument(text: string, baseUrl: string): ConfigDoc {
  let raw: unknown;
  try {
    raw = parseLooseJson(decodeConfigText(text));
  } catch (error) {
    throw new Error(`配置文件既不是 JSON，也不是 base64 编码的 JSON：${messageOf(error)}`);
  }
  const root = (raw ?? {}) as Record<string, unknown>;
  const sites = readSites(root, baseUrl);
  const lives = readLives(root, baseUrl);
  const repos = readRepos(root, baseUrl);
  if (sites.length === 0 && lives.length === 0 && repos.length === 0) {
    throw new Error("配置里没有站点、直播源或多仓地址");
  }
  return {
    name: String(root.name ?? root.title ?? ""),
    sites,
    lives,
    parses: readParses(root, baseUrl),
    flags: Array.isArray(root.flags) ? root.flags.map((flag) => String(flag)) : [],
    repos,
    spider: readSpider(root, baseUrl),
  };
}

/** The jar the configuration's `csp_*` sites run, resolved against the configuration's URL. */
function readSpider(root: Record<string, unknown>, baseUrl: string): string {
  const raw = String(root.spider ?? "").trim();
  if (!raw) return "";
  // `…/spider.jar;md5;<hash>`: the hash only tells a client whether to re-download.
  return resolveUrl(raw.split(";")[0], baseUrl);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * The text of a configuration, decoded from the forms TVBox shares:
 * plain JSON, base64 JSON (with whitespace, base64url or a `data:` prefix),
 * a URL-encoded payload, and the `YmFzZTY0**…` marker some servers put before it.
 */
export function decodeConfigText(input: string): string {
  return decodeConfigValue(input, 0);
}

function decodeConfigValue(input: string, depth: number): string {
  const value = input.replace(/^\uFEFF/, "").trim();
  if (!value) throw new Error("配置文件是空的");
  if (isJsonText(value)) return value;
  if (depth >= 3) return value;
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma > 0) return decodeConfigValue(value.slice(comma + 1), depth + 1);
  }
  // `base64**<payload>`: the marker ("base64", its base64 form, "json", …) is
  // ignored, the payload is decoded.
  const mark = value.indexOf("**");
  if (mark > 0 && mark <= 64 && !/[{}[\]]/.test(value.slice(0, mark))) {
    const payload = value.slice(mark + 2).trim();
    if (payload) {
      const decoded = decodeConfigValue(payload, depth + 1);
      if (isJsonText(decoded)) return decoded;
    }
  }
  if (value.includes("%")) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded !== value) {
        if (isJsonText(decoded.trim())) return decoded.trim();
        const inner = decodeConfigValue(decoded, depth + 1);
        if (isJsonText(inner)) return inner;
      }
    } catch {
      // Not a URL-encoded payload.
    }
  }
  const decoded = decodeBase64Text(value);
  if (decoded !== null) {
    const trimmed = decoded.trim();
    if (isJsonText(trimmed)) return trimmed;
    const inner = decodeConfigValue(trimmed, depth + 1);
    if (isJsonText(inner)) return inner;
  }
  return value;
}

function isJsonText(text: string): boolean {
  return text.startsWith("{") || text.startsWith("[");
}

/** UTF-8 text from base64, or null when `input` is not base64. */
export function decodeBase64Text(input: string): string | null {
  let text = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (text.length < 8) return null;
  if (text.length % 4 === 1) return null;
  while (text.length % 4 !== 0) text += "=";
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    let value = 0;
    let padding = 0;
    for (let part = 0; part < 4; part += 1) {
      const character = text[index + part];
      if (character === "=") {
        padding += 1;
        value <<= 6;
        continue;
      }
      const digit = BASE64_ALPHABET.indexOf(character);
      if (digit < 0) return null;
      value = (value << 6) | digit;
    }
    bytes.push((value >> 16) & 0xff);
    if (padding < 2) bytes.push((value >> 8) & 0xff);
    if (padding < 1) bytes.push(value & 0xff);
  }
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

function readRepos(root: Record<string, unknown>, baseUrl: string): ConfigRepo[] {
  const list = Array.isArray(root.urls) ? (root.urls as unknown[]) : [];
  const repos: ConfigRepo[] = [];
  for (const value of list) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const url = resolveUrl(String(item.url ?? item.api ?? ""), baseUrl);
    if (!url) continue;
    repos.push({ name: String(item.name ?? ""), url });
  }
  return repos;
}

function readSites(root: Record<string, unknown>, baseUrl: string): SiteConfig[] {
  const list = Array.isArray(root.sites) ? (root.sites as unknown[]) : [];
  const sites: SiteConfig[] = [];
  for (const value of list) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    // `csp_Name` is the name of a Spider the app would run, not a URL.
    const rawApi = String(item.api ?? item.url ?? "").trim();
    const api = /^csp_/i.test(rawApi) ? rawApi : resolveUrl(rawApi, baseUrl);
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
