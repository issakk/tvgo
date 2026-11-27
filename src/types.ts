// Data types shared by the config loader, the site clients and the pages.

/** A site of a TVBox-style configuration: how one content source is reached. */
export interface SiteConfig {
  key: string;
  name: string;
  /** 0: XML CMS, 1: JSON CMS, 3: Spider (CSP/JS), 4: external app. */
  type: number;
  api: string;
  searchable: number;
  hide: number;
  ext?: string;
}

/** A live-TV playlist of a configuration. */
export interface LiveSource {
  name: string;
  url: string;
  type: number;
}

/** A playback parser declared by a configuration (kept for completeness). */
export interface ParseSource {
  name: string;
  type: number;
  url: string;
}

/** A parsed TVBox-compatible configuration document. */
export interface ConfigDoc {
  name: string;
  sites: SiteConfig[];
  lives: LiveSource[];
  parses: ParseSource[];
  flags: string[];
}

/** One title in a site's list. */
export interface VodItem {
  id: string;
  name: string;
  pic: string;
  remarks: string;
  year: string;
  area: string;
  typeName: string;
}

/** One episode of a play line. */
export interface Episode {
  name: string;
  url: string;
}

/** One play line (线路) of a title. */
export interface PlayLine {
  flag: string;
  episodes: Episode[];
}

/** A title with its play lines, as a site's detail endpoint reports it. */
export interface VodDetail extends VodItem {
  content: string;
  actor: string;
  director: string;
  lines: PlayLine[];
}

/** A category of a site. */
export interface Category {
  id: string;
  name: string;
}

/** One page of a site's list. */
export interface VodPage {
  items: VodItem[];
  page: number;
  pageCount: number;
}

/** One channel of a live playlist. */
export interface LiveChannel {
  id: string;
  name: string;
  url: string;
  group: string;
}
