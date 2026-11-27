// An end-to-end run through a stubbed site: browse, open, play, and find it in history.
import { expect, open, test } from "nsh/test";

/** The configuration the test starts with, as if it had been imported before. */
const SEEDED_CONFIGS = JSON.stringify([
  {
    id: "demo",
    name: "测试配置",
    url: "https://demo.example/config.json",
    updatedAt: 1,
    config: {
      name: "测试配置",
      sites: [
        {
          key: "demo-site",
          name: "演示站",
          type: 1,
          api: "https://demo.example/api.php/provide/vod/",
          searchable: 1,
          hide: 0,
        },
      ],
      lives: [{ name: "演示直播", url: "https://demo.example/live.txt", type: 0 }],
      parses: [],
      flags: [],
    },
  },
]);

const SEEDED_SETTINGS = JSON.stringify({
  theme: "system",
  activeConfigId: "demo",
  siteKey: "demo-site",
  disabledSites: [],
});

const MOVIE = {
  vod_id: 100,
  vod_name: "测试影片",
  vod_pic: "",
  vod_remarks: "HD",
  vod_year: "2024",
  vod_area: "测试区",
  type_name: "电影",
};

/** What the demo site's CMS endpoint answers, by action. */
function cms(request: { url: string }) {
  const url = new URL(request.url);
  if (url.searchParams.get("ac") === "list") {
    return { body: { code: 1, class: [{ type_id: 1, type_name: "电影" }], list: [] } };
  }
  if (url.searchParams.get("ids") === "100") {
    return {
      body: {
        code: 1,
        list: [
          {
            ...MOVIE,
            vod_content: "一部用来测试的影片。",
            vod_actor: "测试演员",
            vod_play_from: "线路一",
            vod_play_url: "第1集$https://demo.example/video/1.m3u8",
          },
        ],
      },
    };
  }
  return { body: { code: 1, page: 1, pagecount: 1, list: [MOVIE] } };
}

test("browses a site, opens a title and plays it", async () => {
  const app = await open("./App.tsx", {
    width: 1280,
    height: 840,
    storage: { "tvgo/configs": SEEDED_CONFIGS, "tvgo/settings": SEEDED_SETTINGS },
    network: {
      "GET https://demo.example/api.php/provide/vod/*": cms,
      "GET https://demo.example/live.txt": { body: "央视,#genre#\nCCTV1,https://demo.example/cctv1.m3u8\n" },
    },
  });

  // The discovery page lists the site's first page.
  await app.waitFor("测试影片");
  expect(app.shows("演示站")).toBe(true);

  // The detail page shows the title's line and episode.
  await app.press("测试影片");
  await app.waitFor("线路一");
  await app.waitFor("第1集");

  // Playing opens the player and records the title in history.
  await app.press("播放 >> nth=0");
  await app.waitFor("暂停");

  // The library keeps the entry, with where playback is.
  await app.press("收藏与历史");
  await app.waitFor("测试影片");
  expect(app.texts().some((text) => text.includes("演示站"))).toBe(true);

  // Live TV loads its playlist and plays the first channel.
  await app.press("直播");
  await app.waitFor("CCTV1");
  expect(app.shows("全部")).toBe(true);
});

/** A config as the servers behind `wmz` send it: base64 after a `YmFzZTY0**` marker. */
const B64_MARKER = "YmFzZTY0";
const B64_CONFIG =
  "eyJuYW1lIjoi5a+85YWl6YWN572uIiwic2l0ZXMiOlt7ImtleSI6ImRlbW8tc2l0ZSIsIm5hbWUiOiLmvJTnpLrnq5kiLCJ0eXBlIjoxLCJhcGkiOiJodHRwczovL2RlbW8uZXhhbXBsZS9hcGkucGhwL3Byb3ZpZGUvdm9kLyJ9XSwibGl2ZXMiOltdfQ==";

test("imports a base64 configuration from settings", async () => {
  const app = await open("./App.tsx", {
    width: 1280,
    height: 840,
    network: {
      "GET https://demo.example/wmz": { body: `\n${B64_MARKER}**${B64_CONFIG}` },
      "GET https://demo.example/api.php/provide/vod/*": cms,
    },
  });
  await app.press("设置");
  await app.waitFor("配置源");
  await app.type("id:config-url", "https://demo.example/wmz");
  await app.press("添加配置");
  // The imported configuration, named by the document inside the base64 payload.
  await app.waitFor("导入配置");
  await app.press("发现");
  await app.waitFor("测试影片");
  expect(app.shows("演示站")).toBe(true);
});
