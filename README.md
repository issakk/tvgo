# TVGo

A Windows desktop TV box, built with [Native Shell (NSH)](https://github.com/longbridge/nsh) in TSX.
It plays what a TVBox/WebHTV-style configuration names: multiple content sites, search across them,
live TV playlists, playback with lines and episodes, favorites and resume.

Every build runs on GitHub Actions (`windows-latest`); nothing is compiled locally.

## Features

- **Configuration sources.** Add TVBox-compatible configurations by URL or paste the JSON: plain JSON, base64 JSON
  (with or without the `YmFzZTY0**` marker some servers put in front, base64url, line breaks, `data:` prefixes,
  URL-encoded payloads) and multi-repo documents (`{"urls":[…]}`), whose repositories are imported as their own
  configurations. Keep several, switch between them, refresh them, and turn individual sites on or off.
- **Sites.** JSON CMS (`ac=list` / `ac=detail` / `ac=videolist`, with the `videolist` fallback older servers need)
  and the legacy XML CMS protocol. Sites are grouped by category, browsed as a poster grid and paged while scrolling.
- **Search.** One query sent to every searchable site, a few at a time, grouped by site with progress and per-site
  errors, with the words searched before kept for one click.
- **Detail and playback.** Poster, metadata, synopsis, play lines (线路) and episodes. The player uses Windows'
  own Media Foundation decoder through NSH's `Video`, with a control bar, `1x`–`2x` rates, keyboard shortcuts and
  full screen. Playlists (`.m3u8`) and progressive files play directly; an episode that is a web page opens in the
  app's own web view, with a button for the system browser.
- **Switching sources (换源).** The detail page can search the other sites for the same title and reopen it there.
- **Continue watching.** The discovery page lists the last titles with the episode and the site they came from.
- **Live TV.** The configuration's live playlists, as TXT (`#genre#` groups) or M3U, with groups, a channel filter,
  previous/next channel and a player.
- **Favorites and history.** Titles kept for later, and playback history that resumes at the episode and position
  where the user stopped.
- **Appearance.** Light, dark or system, from NSH's theme tokens.

- **Spider sites (`api: csp_*`).** A configuration's `spider.jar` runs, without Android, in a companion JVM
  program (`spider-host/`) the app talks to over localhost. With a host running, `csp_*` sites browse, search,
  open details and play like CMS sites; without one they are listed in Settings and left out of browsing, exactly
  as before. Episodes a spider says need a parser (`parse: 1`) are not played yet.

Not supported yet: external-app sites (`type: 4`), `.py` / `.js` spider scripts, and packed spider jars the host
cannot convert. They are listed in Settings as unsupported and left out of browsing and search.

### Spider host

`spider-host/` is a JDK program: it converts the configuration's `classes.dex` to JVM classes (repairing what
dex2jar gets wrong), answers the CatVod `Spider` contract, and serves JSON over `http://127.0.0.1:29123`.
The CI publishes `TVGo-spider-host-windows.zip` (jar + trimmed JRE + `start.cmd`) with each release; unpack it,
run `start.cmd`, then set the address in Settings → Spider 宿主 and press 检测. `spider-host/README.md` documents
the protocol and the repairs.

## Using a configuration

Settings → 配置源 → paste a TVBox-compatible configuration URL (plain JSON, a base64 document such as
`https://8815.kstore.vip/tvbox/wmz`, or a multi-repo `{"urls":[…]}` document) and press 添加配置. TVGo decodes it,
stores the parsed configuration in its own data directory (`%APPDATA%\dev.tvgo.desktop\storage.json`) and shows its
CMS sites in 发现 and 搜索; the repositories of a multi-repo document become configurations of their own.

Episodes the site serves as a media URL play in the native player. An episode that is a web page opens in the
built-in web view (WebView2), so a site's own player and its parse step can run there; the page can also be handed
to the system browser.

## Building

GitHub Actions builds, tests and packages the app:

```text
.github/workflows/windows.yml
  nsh check     type check
  nsh build     bundle
  nsh test      headless tests
  nsh package --target windows
```

`nsh test` runs the data layer's tests (configuration, play lines, playlists), a pass over every page of the shell,
and an end-to-end run against a stubbed site: browse a category, open a title, play an episode, find it in history,
then load a live playlist.

The packaged app lands in `.nsh/out/`:

```text
.nsh/out/TVGo/TVGo.exe        the app, with nsh\bundle.nshc and nsh\assets next to it
.nsh/out/TVGo.zip             the same directory, zipped
.nsh/out/TVGo-setup.exe       an Inno Setup installer (when Inno Setup 6 is installed on the runner)
```

Push a `v*` tag to publish the zip and installer as a GitHub Release.

To work on it locally you need the NSH CLI (v0.7.1), which is what CI installs; `nsh run App.tsx` opens the app
on macOS, Windows or Linux.

## Layout

```text
App.tsx                  the shell: sidebar, navigation stack, window
src/nav.ts               routes and the navigation stack
src/store.ts             app state: configs, sites, live sources, history, favorites (Storage-backed)
src/lib/config.ts        TVBox configuration parsing
src/lib/cms.ts           JSON/XML CMS clients: categories, pages, detail, search, play lines
src/lib/live.ts          TXT and M3U live playlists
src/lib/http.ts          fetch, JSON repair, text cleanup, ids
src/ui/kit.tsx           the app's styled controls (buttons, chips, posters, fields, states)
src/components/          sidebar and page header
src/pages/               Discover, Search, Detail, Player, Live, Library, Settings
```

The app's state is signals behind accessors in `src/store.ts`; pages own only their transient state. Every
network path reports loading, failure and retry, and stale responses are dropped by a per-load token.

## Keyboard

| Key | Where | What it does |
| --- | --- | --- |
| Space | player | play / pause |
| ← / → | player | back / forward 10 s |
| N / B | player | next / previous episode |
| F | player | toggle full screen |
| M | player | mute / unmute |
| Esc | anywhere | leave the player (the page's back) |
| Ctrl+K | anywhere | open search |

## Notes

- Windows 10 1809+ or Windows 11. Playback uses the Media Foundation codecs the system has; HLS support comes
  from Windows' own media stack, so a system without it plays progressive files only.
- The app declares no capabilities, so it can reach any host a configuration names.
- TVGo ships no content, playlists or endpoints: what it plays comes from the configuration the user adds.
