// The app's state: configuration sources, the sites they name, the live
// playlists, playback history and favorites. Signals stay private; pages read
// through the accessors and change through the functions.
import { computed, setColorScheme, signal, Storage } from "nsh";
import type { ConfigDoc, LiveSource, SiteConfig, VodDetail, VodItem } from "./types";
import { parseConfigDocument } from "./lib/config";
import { fetchText, hashId, messageOf } from "./lib/http";
import { loadDetail, searchSite } from "./lib/cms";

const SETTINGS_KEY = "tvgo/settings";
const CONFIGS_KEY = "tvgo/configs";
const HISTORY_KEY = "tvgo/history";
const FAVORITES_KEY = "tvgo/favorites";
const SEARCHES_KEY = "tvgo/searches";

/** A configuration the user added, with what it named when it was read. */
export interface ConfigSource {
  id: string;
  name: string;
  url: string;
  updatedAt: number;
  config: ConfigDoc;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  activeConfigId: string;
  siteKey: string;
  disabledSites: string[];
}

/** One title watched before, and where the user stopped. */
export interface HistoryEntry {
  id: string;
  siteKey: string;
  siteName: string;
  vod: VodItem;
  flagIndex: number;
  epIndex: number;
  epName: string;
  url: string;
  position: number;
  duration: number;
  updatedAt: number;
}

/** One title the user kept. */
export interface FavoriteEntry {
  id: string;
  siteKey: string;
  siteName: string;
  vod: VodItem;
  updatedAt: number;
}

/** The results of one search, one group per site. */
export interface SearchGroup {
  siteKey: string;
  siteName: string;
  items: VodItem[];
  error: string;
}

export interface SearchState {
  keyword: string;
  groups: SearchGroup[];
  busy: boolean;
  done: number;
  total: number;
  error: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  activeConfigId: "",
  siteKey: "",
  disabledSites: [],
};

const configs = signal<ConfigSource[]>([]);
const settings = signal<Settings>({ ...DEFAULT_SETTINGS });
const history = signal<HistoryEntry[]>([]);
const favorites = signal<FavoriteEntry[]>([]);
const searches = signal<string[]>([]);
const ready = signal(false);
const configBusy = signal(false);
const configError = signal("");
const searchState = signal<SearchState>({ keyword: "", groups: [], busy: false, done: 0, total: 0, error: "" });

/** Details already loaded, so the player does not fetch them again. */
const vodCache = new Map<string, VodDetail>();

let searchToken = 0;

// Reading what the last run kept, once the app starts.
void hydrate();

/** Everything the app keeps, read once: resolves when the app can show its state. */
export async function hydrate(): Promise<void> {
  if (ready()) return;
  try {
    const [rawSettings, rawConfigs, rawHistory, rawFavorites, rawSearches] = await Promise.all([
      Storage.getItem(SETTINGS_KEY),
      Storage.getItem(CONFIGS_KEY),
      Storage.getItem(HISTORY_KEY),
      Storage.getItem(FAVORITES_KEY),
      Storage.getItem(SEARCHES_KEY),
    ]);
    configs.set(readConfigs(rawConfigs));
    settings.set(readSettings(rawSettings));
    history.set(readHistory(rawHistory));
    favorites.set(readFavorites(rawFavorites));
    searches.set(readStrings(rawSearches));
    setColorScheme(settings().theme);
  } catch (error) {
    console.warn("TVGo: could not read the saved state", error);
  } finally {
    ready.set(true);
  }
}

/** Whether the saved state has been read. */
export const isReady = () => ready();

/** Every configuration the user added, oldest first. */
export const allConfigs = () => configs();

/** The settings in force. */
export const appSettings = () => settings();

/** The configuration whose sites the app shows. */
export const activeConfig = computed<ConfigSource | null>(() => {
  const list = configs();
  if (list.length === 0) return null;
  const id = settings().activeConfigId;
  return list.find((source) => source.id === id) ?? list[0];
});

/** Every site of the active configuration, including the ones that cannot play here. */
export const documentSites = computed<SiteConfig[]>(() => activeConfig()?.config.sites ?? []);

/** The sites the app can browse: CMS sites that are not hidden or turned off. */
export const configSites = computed<SiteConfig[]>(() => {
  const source = activeConfig();
  if (!source) return [];
  const disabled = new Set(settings().disabledSites);
  return source.config.sites.filter(
    (site) =>
      (site.type === 0 || site.type === 1) &&
      site.hide === 0 &&
      !disabled.has(disabledSiteId(source.id, site.key)),
  );
});

/** The site whose list the discovery page shows. */
export const currentSite = computed<SiteConfig | null>(() => {
  const sites = configSites();
  if (sites.length === 0) return null;
  return sites.find((site) => site.key === settings().siteKey) ?? sites[0];
});

/** The live playlists of the active configuration. */
export const liveSources = computed<LiveSource[]>(() => activeConfig()?.config.lives ?? []);

/** The last search and its progress. */
export const searchResults = () => searchState();

/** Whether a configuration is being read. */
export const isConfigBusy = () => configBusy();

/** Why the last configuration change failed. */
export const configFailure = () => configError();


/** The words searched before, newest first. */
export const recentSearches = () => searches();

/** Keeps a word in the search history, newest first. */
export function rememberSearch(word: string): void {
  const value = word.trim();
  if (!value) return;
  const next = [value, ...searches().filter((item) => item !== value)].slice(0, 12);
  searches.set(next);
  persist(SEARCHES_KEY, next);
}

/** Empties the search history. */
export function clearSearches(): void {
  searches.set([]);
  persist(SEARCHES_KEY, []);
}
/** Playback history, newest first. */
export const historyEntries = () => history();

/** The titles the user kept, newest first. */
export const favoriteEntries = () => favorites();

/** The id a site's on/off setting is stored under. */
export function disabledSiteId(configId: string, siteKey: string): string {
  return `${configId}/${siteKey}`;
}

/** Every site of every configuration with that key. */
export function findSite(key: string): SiteConfig | null {
  for (const source of configs()) {
    for (const site of source.config.sites) {
      if (site.key === key) return site;
    }
  }
  return null;
}

/** Whether the site can be browsed here: its protocol is supported. */
export function isSupportedSite(site: SiteConfig | null): boolean {
  return site !== null && (site.type === 0 || site.type === 1);
}

/** Adds a configuration from a URL and makes it the active one. */
export async function importConfig(url: string): Promise<void> {
  const target = url.trim();
  if (!target) return;
  configBusy.set(true);
  configError.set("");
  try {
    const text = await fetchText(target, 20000);
    const doc = parseConfigDocument(text, target);
    storeConfig(doc, target);
  } catch (error) {
    configError.set(messageOf(error));
  } finally {
    configBusy.set(false);
  }
}

/** Adds a configuration from text the user pasted; relative endpoints are kept as they are. */
export async function importConfigText(text: string, name: string): Promise<void> {
  const value = text.trim();
  if (!value) return;
  configBusy.set(true);
  configError.set("");
  try {
    const doc = parseConfigDocument(value, "");
    if (!doc.name && name.trim()) doc.name = name.trim();
    storeConfig(doc, "");
  } catch (error) {
    configError.set(messageOf(error));
  } finally {
    configBusy.set(false);
  }
}

/** Reads a configuration again, keeping its place in the list. */
export async function refreshConfig(id: string): Promise<void> {
  const source = configs().find((item) => item.id === id);
  if (!source || !source.url) return;
  configBusy.set(true);
  configError.set("");
  try {
    const text = await fetchText(source.url, 20000);
    const doc = parseConfigDocument(text, source.url);
    const next = configs().map((item) =>
      item.id === id ? { ...item, config: doc, updatedAt: Date.now(), name: doc.name || item.name } : item,
    );
    configs.set(next);
    persist(CONFIGS_KEY, next);
  } catch (error) {
    configError.set(messageOf(error));
  } finally {
    configBusy.set(false);
  }
}

/** Removes a configuration and everything that pointed at it. */
export function removeConfig(id: string): void {
  const next = configs().filter((item) => item.id !== id);
  configs.set(next);
  persist(CONFIGS_KEY, next);
  if (settings().activeConfigId === id) {
    const first = next[0];
    patchSettings({ activeConfigId: first?.id ?? "", siteKey: "" });
  }
}

/** Makes a configuration the active one. */
export function chooseConfig(id: string): void {
  const source = configs().find((item) => item.id === id);
  if (!source) return;
  const site = source.config.sites.find((item) => (item.type === 0 || item.type === 1) && item.hide === 0);
  patchSettings({ activeConfigId: id, siteKey: site?.key ?? "" });
}

/** Shows another site of the active configuration. */
export function selectSite(key: string): void {
  patchSettings({ siteKey: key });
}

/** Turns one site of one configuration on or off. */
export function setSiteEnabled(configId: string, siteKey: string, enabled: boolean): void {
  const id = disabledSiteId(configId, siteKey);
  const current = new Set(settings().disabledSites);
  if (enabled) current.delete(id);
  else current.add(id);
  patchSettings({ disabledSites: [...current] });
}

/** Whether one site of one configuration is turned on. */
export function siteEnabled(configId: string, siteKey: string): boolean {
  return !settings().disabledSites.includes(disabledSiteId(configId, siteKey));
}

/** Shows the app in another appearance. */
export function setTheme(theme: Settings["theme"]): void {
  patchSettings({ theme });
  setColorScheme(theme);
}

/** A title's detail, read once and kept for the player. */
export async function ensureVodDetail(site: SiteConfig, id: string): Promise<VodDetail> {
  const key = vodKey(site.key, id);
  const cached = vodCache.get(key);
  if (cached) return cached;
  const detail = await loadDetail(site, id);
  vodCache.set(key, detail);
  return detail;
}

/** The detail the discovery or search page already loaded, if any. */
export function cachedVodDetail(siteKey: string, id: string): VodDetail | null {
  return vodCache.get(vodKey(siteKey, id)) ?? null;
}

/** Keeps a loaded detail for the player. */
export function rememberVodDetail(detail: VodDetail, siteKey: string): void {
  vodCache.set(vodKey(siteKey, detail.id), detail);
}

/** Searches every site that offers search, a few at a time. */
export async function searchAll(keyword: string): Promise<void> {
  const word = keyword.trim();
  if (!word) return;
  rememberSearch(word);
  const sites = configSites().filter((site) => site.searchable !== 0);
  const mine = (searchToken += 1);
  searchState.set({ keyword: word, groups: [], busy: sites.length > 0, done: 0, total: sites.length, error: "" });
  if (sites.length === 0) {
    searchState.set({ keyword: word, groups: [], busy: false, done: 0, total: 0, error: "没有可搜索的站点" });
    return;
  }
  let done = 0;
  const groups = await mapLimit(sites, 6, async (site): Promise<SearchGroup> => {
    try {
      const items = await searchSite(site, word);
      return { siteKey: site.key, siteName: site.name, items: items.slice(0, 40), error: "" };
    } catch (error) {
      return { siteKey: site.key, siteName: site.name, items: [], error: messageOf(error) };
    } finally {
      done += 1;
      if (mine === searchToken) {
        searchState.update((state) => ({ ...state, done }));
      }
    }
  });
  if (mine !== searchToken) return;
  const found = groups
    .filter((group) => group.items.length > 0 || group.error)
    .sort((a, b) => b.items.length - a.items.length);
  searchState.set({ keyword: word, groups: found, busy: false, done: sites.length, total: sites.length, error: "" });
}

/** Searches the other sites for a title the detail page is showing, for 换源. */
export async function searchNameOnSites(name: string, excludeKey: string): Promise<SearchGroup[]> {
  const word = name.trim();
  if (!word) return [];
  const sites = configSites().filter((site) => site.searchable !== 0 && site.key !== excludeKey);
  const groups = await mapLimit(sites, 6, async (site): Promise<SearchGroup> => {
    try {
      const items = await searchSite(site, word);
      return { siteKey: site.key, siteName: site.name, items: items.slice(0, 12), error: "" };
    } catch (error) {
      return { siteKey: site.key, siteName: site.name, items: [], error: messageOf(error) };
    }
  });
  return groups.filter((group) => group.items.length > 0);
}

/** Records where the user is in a title: the newest entry for it moves to the front. */
export function recordHistory(entry: Omit<HistoryEntry, "id" | "updatedAt">): void {
  const id = vodKey(entry.siteKey, entry.vod.id);
  const next: HistoryEntry[] = [
    { ...entry, id, updatedAt: Date.now() },
    ...history().filter((item) => item.id !== id),
  ].slice(0, 200);
  history.set(next);
  persist(HISTORY_KEY, next);
}

/** Updates the position of an entry without moving it to the front. */
export function updateHistoryPosition(siteKey: string, vodId: string, position: number, duration: number): void {
  const id = vodKey(siteKey, vodId);
  const current = history();
  const found = current.find((item) => item.id === id);
  if (!found) return;
  const next = current.map((item) => (item.id === id ? { ...item, position, duration, updatedAt: Date.now() } : item));
  history.set(next);
  persist(HISTORY_KEY, next);
}

/** The entry of one title, if it was watched before. */
export function historyFor(siteKey: string, vodId: string): HistoryEntry | null {
  return history().find((item) => item.id === vodKey(siteKey, vodId)) ?? null;
}

/** Removes one title from history. */
export function removeHistory(id: string): void {
  const next = history().filter((item) => item.id !== id);
  history.set(next);
  persist(HISTORY_KEY, next);
}

/** Empties the history. */
export function clearHistory(): void {
  history.set([]);
  persist(HISTORY_KEY, []);
}

/** Keeps a title, or lets it go; resolves with whether it is kept now. */
export function toggleFavorite(siteKey: string, siteName: string, vod: VodItem): boolean {
  const id = vodKey(siteKey, vod.id);
  const current = favorites();
  const exists = current.some((item) => item.id === id);
  const next = exists
    ? current.filter((item) => item.id !== id)
    : [{ id, siteKey, siteName, vod, updatedAt: Date.now() }, ...current];
  favorites.set(next);
  persist(FAVORITES_KEY, next);
  return !exists;
}

/** Whether a title is kept. */
export function isFavorite(siteKey: string, vodId: string): boolean {
  return favorites().some((item) => item.id === vodKey(siteKey, vodId));
}

/** Removes one kept title. */
export function removeFavorite(id: string): void {
  const next = favorites().filter((item) => item.id !== id);
  favorites.set(next);
  persist(FAVORITES_KEY, next);
}

/** Empties the kept titles. */
export function clearFavorites(): void {
  favorites.set([]);
  persist(FAVORITES_KEY, []);
}

/** Removes every configuration, the history and the kept titles. */
export function clearAllData(): void {
  configs.set([]);
  history.set([]);
  favorites.set([]);
  searches.set([]);
  settings.set({ ...DEFAULT_SETTINGS });
  vodCache.clear();
  persist(CONFIGS_KEY, []);
  persist(HISTORY_KEY, []);
  persist(FAVORITES_KEY, []);
  persist(SEARCHES_KEY, []);
  persist(SETTINGS_KEY, settings());
  setColorScheme("system");
}

/** The key a title is kept under. */
export function vodKey(siteKey: string, vodId: string): string {
  return `${siteKey}:${vodId}`;
}

// Reading and writing what the app keeps.


function storeConfig(doc: ConfigDoc, url: string): void {
  const id = hashId(url || `${doc.name}|${doc.sites.length}|${doc.sites[0]?.api ?? ""}`);
  const source: ConfigSource = {
    id,
    name: doc.name || doc.sites[0]?.name || "配置",
    url,
    updatedAt: Date.now(),
    config: doc,
  };
  const existing = configs().find((item) => item.id === id);
  const next = existing ? configs().map((item) => (item.id === id ? source : item)) : [...configs(), source];
  configs.set(next);
  persist(CONFIGS_KEY, next);
  const site = doc.sites.find((item) => (item.type === 0 || item.type === 1) && item.hide === 0);
  patchSettings({ activeConfigId: id, siteKey: site?.key ?? "" });
}

function patchSettings(patch: Partial<Settings>): void {
  const next = { ...settings(), ...patch };
  settings.set(next);
  persist(SETTINGS_KEY, next);
}

function persist(key: string, value: unknown): void {
  Storage.setItem(key, JSON.stringify(value)).catch((error) => {
    console.warn(`TVGo: could not save ${key}`, error);
  });
}


function readJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readSettings(raw: string | null): Settings {
  const value = readJson(raw);
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const record = value as Record<string, unknown>;
  const theme = record.theme;
  return {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : "system",
    activeConfigId: typeof record.activeConfigId === "string" ? record.activeConfigId : "",
    siteKey: typeof record.siteKey === "string" ? record.siteKey : "",
    disabledSites: Array.isArray(record.disabledSites) ? record.disabledSites.map((item) => String(item)) : [],
  };
}

function readConfigs(raw: string | null): ConfigSource[] {
  const value = readJson(raw);
  if (!Array.isArray(value)) return [];
  const result: ConfigSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const config = record.config as ConfigDoc | undefined;
    if (!config || !Array.isArray(config.sites)) continue;
    result.push({
      id: String(record.id ?? ""),
      name: String(record.name ?? "配置"),
      url: String(record.url ?? ""),
      updatedAt: Number(record.updatedAt ?? 0) || 0,
      config: {
        name: String(config.name ?? ""),
        sites: config.sites,
        lives: Array.isArray(config.lives) ? config.lives : [],
        parses: Array.isArray(config.parses) ? config.parses : [],
        flags: Array.isArray(config.flags) ? config.flags : [],
      },
    });
  }
  return result.filter((source) => source.id);
}

function readHistory(raw: string | null): HistoryEntry[] {
  const value = readJson(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && (item as HistoryEntry).id).map((item) => {
    const entry = item as HistoryEntry;
    return {
      ...entry,
      position: Number(entry.position) || 0,
      duration: Number(entry.duration) || 0,
      updatedAt: Number(entry.updatedAt) || 0,
    };
  });
}

function readFavorites(raw: string | null): FavoriteEntry[] {
  const value = readJson(raw);
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && (item as FavoriteEntry).id)
    .map((item) => item as FavoriteEntry);
}

function readStrings(raw: string | null): string[] {
  const value = readJson(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item as string);
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
