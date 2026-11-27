# TVGo

A Windows desktop TV box, built with [Native Shell (NSH)](https://github.com/longbridge/nsh) in TSX.
It plays what a TVBox/WebHTV-style configuration names: multiple content sites, search across them,
live TV playlists, playback with lines and episodes, favorites and resume.

Every build runs on GitHub Actions (`windows-latest`); nothing is compiled locally.

## Features

- **Configuration sources.** Add TVBox-compatible JSON configurations by URL or paste the JSON. Keep several,
  switch between them, refresh them, and turn individual sites on or off.
- **Sites.** JSON CMS (`ac=list` / `ac=detail` / `ac=videolist`, with the `videolist` fallback older servers need)
  and the legacy XML CMS protocol. Sites are grouped by category, browsed as a poster grid and paged while scrolling.
- **Search.** One query sent to every searchable site, a few at a time, grouped by site with progress and per-site errors.
- **Detail and playback.** Poster, metadata, synopsis, play lines (线路) and episodes. The player uses Windows'
  own Media Foundation decoder through NSH's `Video`, with a control bar, `1x`–`2x` rates, keyboard shortcuts and
  full screen. Playlists (`.m3u8`) and progressive files play directly.
- **Live TV.** The configuration's live playlists, as TXT (`#genre#` groups) or M3U, with groups, channels and a player.
- **Favorites and history.** Titles kept for later, and playback history that resumes at the episode and position
  where the user stopped.
- **Appearance.** Light, dark or system, from NSH's theme tokens.

Not supported yet: CSP Spider sites (`api: csp_*`) and external-app sites (`type: 4`) need a JavaScript spider
runtime or the external app; they are listed in Settings, marked as unsupported, and left out of browsing and search.

## Using a configuration

Settings → 配置源 → paste a TVBox-compatible configuration URL (for example a `tvbox.json` that lists
`{"sites": [...], "lives": [...]}`) and press 添加配置. TVGo stores the parsed configuration in its own data
directory (`%APPDATA%\dev.tvgo.desktop\storage.json`) and shows its CMS sites in 发现 and 搜索.

Playback needs a URL the site serves directly (`.m3u8`, `.mp4`, …). Sites that return a web page and expect an
external parser (解析) will load, but their episodes may not play.

## Building

GitHub Actions builds, tests and packages the app:

```text
.github/workflows/windows.yml
  nsh check     type check
  nsh build     bundle
  nsh test      headless tests
  nsh package --target windows
```

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

| Key | In the player |
| --- | --- |
| Space | play / pause |
| ← / → | back / forward 10 s |
| N / B | next / previous episode |
| F | toggle full screen |
| Esc | leave the player (the page's back) |

## Notes

- Windows 10 1809+ or Windows 11. Playback uses the Media Foundation codecs the system has; HLS support comes
  from Windows' own media stack, so a system without it plays progressive files only.
- The app declares no capabilities, so it can reach any host a configuration names.
- TVGo ships no content, playlists or endpoints: what it plays comes from the configuration the user adds.
