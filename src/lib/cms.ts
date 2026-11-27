// The site clients: the JSON CMS protocol most TVBox configurations use, and
// the older XML CMS protocol some of them still name, for lists, details,
// search and the play lines of a title.
import type { Category, Episode, PlayLine, SiteConfig, VodDetail, VodItem, VodPage } from "../types";
import { cleanText, fetchText, parseLooseJson } from "./http";

/** Builds a URL from a site endpoint and the query it takes. */
function endpoint(api: string, params: Record<string, string | number | undefined>): string {
  let url: URL;
  try {
    url = new URL(api);
  } catch {
    return api;
  }
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const parsed = parseLooseJson(await fetchText(url));
  return (parsed ?? {}) as Record<string, unknown>;
}

function listOf(data: Record<string, unknown>): unknown[] {
  return Array.isArray(data.list) ? (data.list as unknown[]) : [];
}

function pageCountOf(data: Record<string, unknown>, fallback: number): number {
  const count = Number(data.pagecount ?? data.page_count ?? data.totalpage);
  return Number.isFinite(count) && count > 0 ? count : fallback;
}

/** One title of a JSON list, in the app's model. */
function toItem(value: unknown): VodItem {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.vod_id ?? raw.id ?? raw.vodId ?? "").trim(),
    name: cleanText(raw.vod_name ?? raw.name),
    pic: cleanText(raw.vod_pic ?? raw.pic ?? raw.vod_pic_slide),
    remarks: cleanText(raw.vod_remarks ?? raw.note ?? raw.vod_sub),
    year: cleanText(raw.vod_year ?? raw.year),
    area: cleanText(raw.vod_area ?? raw.area),
    typeName: cleanText(raw.type_name ?? raw.typeName ?? raw.vod_class),
  };
}

/** The play lines of a detail response: `from` and `url` are both `$$$`-separated. */
export function parsePlayLines(playFrom: string, playUrl: string): PlayLine[] {
  const flags = playFrom.split("$$$");
  const groups = playUrl.split("$$$");
  const lines: PlayLine[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const episodes: Episode[] = [];
    for (const step of groups[index].split("#")) {
      const entry = step.trim();
      if (!entry) continue;
      const mark = entry.indexOf("$");
      const name = mark >= 0 ? entry.slice(0, mark).trim() : entry;
      const url = mark >= 0 ? entry.slice(mark + 1).trim() : entry;
      if (!url) continue;
      episodes.push({ name: name || `第${episodes.length + 1}集`, url });
    }
    if (episodes.length === 0) continue;
    const flag = (flags[index] ?? "").trim();
    lines.push({ flag: flag || `线路${lines.length + 1}`, episodes });
  }
  return lines;
}

/** The categories a site offers. */
export async function loadCategories(site: SiteConfig): Promise<Category[]> {
  if (site.type === 0) {
    return xmlCategories(await fetchText(endpoint(site.api, { ac: "list" })));
  }
  const data = await getJson(endpoint(site.api, { ac: "list" }));
  const classes = Array.isArray(data.class) ? (data.class as unknown[]) : [];
  return classes
    .map((value) => {
      const raw = (value ?? {}) as Record<string, unknown>;
      return {
        id: String(raw.type_id ?? raw.typeId ?? raw.id ?? "").trim(),
        name: cleanText(raw.type_name ?? raw.typeName ?? raw.name),
      };
    })
    .filter((category) => category.id && category.name);
}

/** One page of a site's list for `typeId`. */
export async function loadPage(site: SiteConfig, typeId: string, page: number): Promise<VodPage> {
  if (site.type === 0) {
    return xmlPage(await fetchText(endpoint(site.api, { ac: "list", t: typeId, pg: page })), page);
  }
  let data = await getJson(endpoint(site.api, { ac: "detail", t: typeId, pg: page }));
  let list = listOf(data);
  if (list.length === 0) {
    // Older CMS servers only know the videolist action.
    const fallback = await getJson(endpoint(site.api, { ac: "videolist", t: typeId, pg: page }));
    const fallbackList = listOf(fallback);
    if (fallbackList.length > 0) {
      data = fallback;
      list = fallbackList;
    }
  }
  return {
    items: list.map(toItem).filter((item) => item.id && item.name),
    page: Number(data.page ?? page) || page,
    pageCount: pageCountOf(data, 1),
  };
}

/** One title with its play lines. */
export async function loadDetail(site: SiteConfig, id: string): Promise<VodDetail> {
  if (site.type === 0) {
    return xmlDetail(await fetchText(endpoint(site.api, { ac: "list", ids: id })));
  }
  let data = await getJson(endpoint(site.api, { ac: "detail", ids: id }));
  let list = listOf(data);
  if (list.length === 0) {
    data = await getJson(endpoint(site.api, { ac: "videolist", ids: id }));
    list = listOf(data);
  }
  const raw = (list[0] ?? null) as Record<string, unknown> | null;
  if (!raw) throw new Error("站点没有返回详情");
  const item = toItem(raw);
  return {
    ...item,
    content: cleanText(raw.vod_content ?? raw.content ?? raw.des),
    actor: cleanText(raw.vod_actor ?? raw.actor),
    director: cleanText(raw.vod_director ?? raw.director),
    lines: parsePlayLines(String(raw.vod_play_from ?? ""), String(raw.vod_play_url ?? "")),
  };
}

/** The titles `keyword` finds on one site. */
export async function searchSite(site: SiteConfig, keyword: string): Promise<VodItem[]> {
  const word = keyword.trim();
  if (!word) return [];
  if (site.type === 0) {
    const text = await fetchText(endpoint(site.api, { ac: "list", wd: word, pg: 1 }));
    return xmlVideos(text)
      .map(toItem)
      .filter((item) => item.id && item.name);
  }
  let data = await getJson(endpoint(site.api, { ac: "detail", wd: word, pg: 1 }));
  let list = listOf(data);
  if (list.length === 0) {
    data = await getJson(endpoint(site.api, { ac: "videolist", wd: word, pg: 1 }));
    list = listOf(data);
  }
  return list.map(toItem).filter((item) => item.id && item.name);
}

// The XML CMS protocol (`?ac=list` returns an RSS document).

function xmlElements(text: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const elements: string[] = [];
  let match = pattern.exec(text);
  while (match !== null) {
    elements.push(match[0]);
    match = pattern.exec(text);
  }
  return elements;
}

function xmlValue(element: string, tag: string): string {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = pattern.exec(element);
  return match ? cleanText(match[1]) : "";
}

function xmlAttribute(element: string, name: string): string {
  const pattern = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i");
  const match = pattern.exec(element);
  return match ? match[1] : "";
}

function xmlVideos(text: string): unknown[] {
  return xmlElements(text, "video").map((element) => ({
    vod_id: xmlValue(element, "id"),
    vod_name: xmlValue(element, "name"),
    vod_pic: xmlValue(element, "pic"),
    vod_remarks: xmlValue(element, "note") || xmlValue(element, "des"),
    vod_year: xmlValue(element, "year"),
    vod_area: xmlValue(element, "area"),
    type_name: xmlValue(element, "type"),
    vod_content: xmlValue(element, "des"),
    vod_actor: xmlValue(element, "actor"),
    vod_director: xmlValue(element, "director"),
    vod_play_url: xmlElements(element, "dd")
      .map((dd) => xmlValue(dd, "dd") || cleanText(dd.replace(/^<dd[^>]*>/i, "").replace(/<\/dd>$/i, "")))
      .filter((url) => url.length > 0)
      .join("$$$"),
    vod_play_from: xmlElements(element, "dd")
      .map((dd) => xmlAttribute(dd, "flag") || "线路")
      .join("$$$"),
  }));
}

function xmlCategories(text: string): Category[] {
  const categories: Category[] = [];
  for (const element of xmlElements(text, "ty")) {
    const id = xmlAttribute(element, "id");
    const name = xmlValue(element, "ty");
    if (id && name) categories.push({ id, name });
  }
  return categories;
}

function xmlPage(text: string, page: number): VodPage {
  return {
    items: xmlVideos(text)
      .map(toItem)
      .filter((item) => item.id && item.name),
    page: Number(xmlValue(text, "page") || page) || page,
    pageCount: Number(xmlValue(text, "pagecount") || 1) || 1,
  };
}

function xmlDetail(text: string): VodDetail {
  const values = xmlVideos(text);
  const raw = (values[0] ?? null) as Record<string, unknown> | null;
  if (!raw) throw new Error("站点没有返回详情");
  const item = toItem(raw);
  return {
    ...item,
    content: cleanText(raw.vod_content),
    actor: cleanText(raw.vod_actor),
    director: cleanText(raw.vod_director),
    lines: parsePlayLines(String(raw.vod_play_from ?? ""), String(raw.vod_play_url ?? "")),
  };
}
