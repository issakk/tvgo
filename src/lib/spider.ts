// The spider hosts: `type: 3` sites run a CatVod spider, which needs an Android runtime.
// A companion JVM program (spider-host/) is the runtime here; this module is its client.
// Nothing in the app depends on the host being up: without one, spider sites are listed
// but stay out of browsing, exactly as before.
import type { Category, SiteConfig, VodDetail, VodItem, VodPage } from "../types";
import { cleanText, messageOf, parseLooseJson } from "./http";
import { parsePlayLines } from "./cms";

/** Where the host listens by default. */
export const DEFAULT_SPIDER_HOST = "http://127.0.0.1:29123";

/** How long a host request may take before it is given up on. */
const REQUEST_TIMEOUT = 40000;

let hostUrl = DEFAULT_SPIDER_HOST;
let spiderJar = "";
let nextId = 1;

/** Points the client at a host and at the jar the active configuration names. */
export function setSpiderTarget(host: string, jar: string): void {
  hostUrl = (host || DEFAULT_SPIDER_HOST).replace(/\/+$/, "");
  spiderJar = jar;
}

/** The host this client talks to. */
export function spiderHost(): string {
  return hostUrl;
}

/** The jar the active configuration names, or "" when it names none. */
export function spiderJarUrl(): string {
  return spiderJar;
}

/** Whether a spider can run at all: the configuration names a jar and the host answers. */
export async function spiderAvailable(): Promise<boolean> {
  if (!spiderJar) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${hostUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

interface SpiderResponse {
  id: number;
  ok: boolean;
  result?: string;
  error?: string;
}

/** The host's log tail, for the settings page's diagnostics view. */
export async function spiderLog(lines = 200): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${hostUrl}/log?lines=${lines}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** One request to the host, with the timeout and error shape the pages expect. */
async function call(request: Record<string, unknown>): Promise<string> {
  if (!spiderJar) throw new Error("这个配置没有声明 spider，csp_ 站点无法运行");
  const id = nextId++;
  const body = JSON.stringify({ id, jar: spiderJar, ...request });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  let response: Response;
  try {
    response = await fetch(`${hostUrl}/rpc`, { method: "POST", body, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Spider 宿主超时（${hostUrl}）`);
    throw new Error(`Spider 宿主没有响应（${hostUrl}）：${messageOf(error)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Spider 宿主返回 HTTP ${response.status}`);
  const parsed = (await response.json()) as SpiderResponse;
  if (!parsed.ok) throw new Error(parsed.error ?? "Spider 调用失败");
  return parsed.result ?? "{}";
}

function siteRequest(site: SiteConfig): Record<string, unknown> {
  return { api: site.api, ext: site.ext ?? "", siteKey: site.key };
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return (parseLooseJson(text) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Spider 返回的不是 JSON：${messageOf(error)}`);
  }
}

function toCategory(value: unknown): Category {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.type_id ?? raw.typeId ?? "").trim(),
    name: cleanText(raw.type_name ?? raw.typeName),
  };
}

function toItem(value: unknown): VodItem {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.vod_id ?? raw.id ?? "").trim(),
    name: cleanText(raw.vod_name ?? raw.name),
    pic: cleanText(raw.vod_pic ?? raw.pic),
    remarks: cleanText(raw.vod_remarks ?? raw.note),
    year: cleanText(raw.vod_year ?? raw.year),
    area: cleanText(raw.vod_area ?? raw.area),
    typeName: cleanText(raw.type_name ?? raw.typeName),
  };
}

/** The categories a spider site offers. */
export async function spiderCategories(site: SiteConfig): Promise<Category[]> {
  const data = parseJson(await call({ op: "home", ...siteRequest(site) }));
  const classes = Array.isArray(data.class) ? (data.class as unknown[]) : [];
  const categories = classes.map(toCategory).filter((category) => category.id);
  if (categories.length > 0) return categories;
  // A site that only serves a home list has one implicit category.
  const list = Array.isArray(data.list) ? (data.list as unknown[]) : [];
  return list.length > 0 ? [{ id: "", name: "推荐" }] : [];
}

/** One page of a spider site's list; `typeId` "" asks for the home list. */
export async function spiderPage(site: SiteConfig, typeId: string, page: number): Promise<VodPage> {
  if (!typeId) {
    const data = parseJson(await call({ op: "home", ...siteRequest(site) }));
    const items = (Array.isArray(data.list) ? (data.list as unknown[]) : []).map(toItem);
    return { items, page: 1, pageCount: 1 };
  }
  const data = parseJson(
    await call({ op: "category", tid: typeId, pg: String(page), filter: false, ...siteRequest(site) }),
  );
  const items = (Array.isArray(data.list) ? (data.list as unknown[]) : []).map(toItem);
  const count = Number(data.pagecount ?? data.page_count ?? data.totalpage);
  return {
    items,
    page: Number(data.page ?? page) || page,
    pageCount: Number.isFinite(count) && count > 0 ? count : page + 1,
  };
}

/** A title's detail, with its play lines. */
export async function spiderDetail(site: SiteConfig, id: string): Promise<VodDetail> {
  const data = parseJson(await call({ op: "detail", ids: [id], ...siteRequest(site) }));
  const list = Array.isArray(data.list) ? (data.list as unknown[]) : [];
  const first = (list[0] ?? {}) as Record<string, unknown>;
  if (!first || Object.keys(first).length === 0) throw new Error("这个站点没有返回详情");
  const item = toItem(first);
  const from = String(first.vod_play_from ?? "");
  const url = String(first.vod_play_url ?? "");
  return {
    ...item,
    id: item.id || id,
    content: cleanText(first.vod_content ?? first.content ?? first.desc),
    actor: cleanText(first.vod_actor ?? first.actor),
    director: cleanText(first.vod_director ?? first.director),
    lines: parsePlayLines(from, url),
  };
}

/** The titles a spider site finds for `keyword`. */
export async function spiderSearch(site: SiteConfig, keyword: string): Promise<VodItem[]> {
  const data = parseJson(await call({ op: "search", key: keyword, quick: true, ...siteRequest(site) }));
  const list = Array.isArray(data.list) ? (data.list as unknown[]) : [];
  return list.map(toItem).filter((item) => item.id);
}

/** What a spider says about playing one episode: a URL plus whether it needs a parser. */
export interface SpiderPlay {
  url: string;
  parse: number;
  header?: Record<string, string>;
}

export async function spiderPlay(site: SiteConfig, flag: string, episodeId: string): Promise<SpiderPlay> {
  const data = parseJson(
    await call({ op: "player", flag, vid: episodeId, vip: [], ...siteRequest(site) }),
  );
  const url = String(data.url ?? "").trim();
  if (!url) throw new Error("这个站点没有给出播放地址");
  return { url, parse: Number(data.parse ?? 0) || 0, header: (data.header ?? {}) as Record<string, string> };
}
