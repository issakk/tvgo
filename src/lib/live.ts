// Live playlists: the TXT lists TVBox configurations name and M3U files.
import type { LiveChannel } from "../types";
import { hashId } from "./http";

/** Channels of a live playlist, in groups; an M3U file or a TXT list. */
export function parseLiveChannels(text: string): LiveChannel[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const channels = /#EXTM3U|#EXTINF/i.test(trimmed) ? parseM3u(trimmed) : parseTxt(trimmed);
  return withIds(channels);
}

function parseM3u(text: string): LiveChannel[] {
  const channels: LiveChannel[] = [];
  let pending: { name: string; group: string } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    if (/^#EXTINF/i.test(value)) {
      const comma = value.lastIndexOf(",");
      const title = comma >= 0 ? value.slice(comma + 1).trim() : "";
      const tvgName = /tvg-name\s*=\s*"([^"]*)"/i.exec(value)?.[1]?.trim() ?? "";
      const group = /group-title\s*=\s*"([^"]*)"/i.exec(value)?.[1]?.trim() ?? "";
      pending = { name: title || tvgName || "频道", group: group || "默认" };
      continue;
    }
    if (value.startsWith("#")) continue;
    if (!pending) continue;
    channels.push({ id: "", name: pending.name, url: value, group: pending.group });
    pending = null;
  }
  return channels;
}

function parseTxt(text: string): LiveChannel[] {
  const channels: LiveChannel[] = [];
  let group = "默认";
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    if (/#genre#/i.test(value)) {
      group = value.split(",")[0].trim() || "默认";
      continue;
    }
    const comma = value.indexOf(",");
    if (comma <= 0) continue;
    const name = value.slice(0, comma).trim();
    const url = value.slice(comma + 1).trim();
    if (!name || !/^[a-z][a-z0-9+.-]*:/i.test(url)) continue;
    channels.push({ id: "", name, url, group });
  }
  return channels;
}

function withIds(channels: LiveChannel[]): LiveChannel[] {
  const seen = new Set<string>();
  const result: LiveChannel[] = [];
  for (const channel of channels) {
    const id = hashId(`${channel.group}|${channel.name}|${channel.url}`);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ ...channel, id });
  }
  return result;
}

/** The groups of `channels` in order, with how many channels each has. */
export function liveGroups(channels: LiveChannel[]): { name: string; count: number }[] {
  const groups: { name: string; count: number }[] = [];
  for (const channel of channels) {
    const group = groups.find((value) => value.name === channel.group);
    if (group) group.count += 1;
    else groups.push({ name: channel.group, count: 1 });
  }
  return groups;
}
