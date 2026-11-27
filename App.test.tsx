// The data layer's pure parts, and the shell's first frame.
import { expect, open, test } from "nsh/test";
import { parsePlayLines } from "./src/lib/cms";
import { parseConfigDocument } from "./src/lib/config";
import { parseLiveChannels } from "./src/lib/live";

/** The JSON the base64 tests decode: one CMS site on `x.example`. */
const B64_JSON = {
  name: "B64",
  sites: [{ key: "a", name: "A", type: 1, api: "https://x.example/api.php" }],
};

/** `B64_JSON` in base64, as the config servers send it. */
const B64_TEXT =
  "eyJuYW1lIjoiQjY0Iiwic2l0ZXMiOlt7ImtleSI6ImEiLCJuYW1lIjoiQSIsInR5cGUiOjEsImFwaSI6Imh0dHBzOi8veC5leGFtcGxlL2FwaS5waHAifV19";

test("reads a TVBox configuration and resolves relative endpoints", () => {
  const text = JSON.stringify({
    name: "Test",
    sites: [{ key: "a", name: "站点 A", type: 1, api: "./api.php/provide/vod/" }],
    lives: [{ name: "直播", url: "live.txt" }],
  });
  const document = parseConfigDocument(text, "https://example.com/config.json");
  expect(document.sites).toHaveLength(1);
  expect(document.sites[0].api).toBe("https://example.com/api.php/provide/vod/");
  expect(document.lives[0].url).toBe("https://example.com/live.txt");
});

test("decodes base64 configurations, with the marker TVBox servers add", () => {
  // Plain base64.
  expect(parseConfigDocument(B64_TEXT, "").sites[0].api).toBe("https://x.example/api.php");
  // `YmFzZTY0**` (base64 of "base64") in front, as https://8815.kstore.vip/tvbox/wmz sends it.
  expect(parseConfigDocument(`\nYmFzZTY0**${B64_TEXT}`, "").sites).toHaveLength(1);
  // A URL-encoded JSON document.
  const encoded = encodeURIComponent(JSON.stringify(B64_JSON));
  expect(parseConfigDocument(encoded, "").sites).toHaveLength(1);
  // Base64 with line breaks.
  const wrapped = B64_TEXT.replace(/(.{40})/g, "$1\n");
  expect(parseConfigDocument(wrapped, "").sites).toHaveLength(1);
});

test("reads a live-only configuration", () => {
  const document = parseConfigDocument(
    JSON.stringify({ lives: [{ name: "直播", url: "https://x.example/live.txt" }] }),
    "",
  );
  expect(document.sites).toHaveLength(0);
  expect(document.lives).toHaveLength(1);
});

test("reads a multi-repo configuration", () => {
  const text = JSON.stringify({
    urls: [{ name: "子仓", url: "sub/config.json" }, { url: "https://cdn.example/other.json" }],
  });
  const document = parseConfigDocument(text, "https://x.example/main.json");
  expect(document.sites).toHaveLength(0);
  expect(document.repos).toHaveLength(2);
  expect(document.repos[0].name).toBe("子仓");
  expect(document.repos[0].url).toBe("https://x.example/sub/config.json");
  expect(document.repos[1].url).toBe("https://cdn.example/other.json");
});

test("splits play lines into episodes", () => {
  const lines = parsePlayLines(
    "线路一$$$线路二",
    "第1集$https://a.example/1.m3u8#第2集$https://a.example/2.m3u8$$$https://b.example/1.m3u8",
  );
  expect(lines).toHaveLength(2);
  expect(lines[0].episodes[1].name).toBe("第2集");
  expect(lines[1].episodes[0].url).toBe("https://b.example/1.m3u8");
});

test("reads a TXT live playlist", () => {
  const channels = parseLiveChannels("央视,#genre#\nCCTV1,https://a.example/cctv1.m3u8\nCCTV2,https://a.example/cctv2.m3u8\n");
  expect(channels).toHaveLength(2);
  expect(channels[0].name).toBe("CCTV1");
  expect(channels[0].group).toBe("央视");
});

test("reads an M3U live playlist", () => {
  const channels = parseLiveChannels(
    '#EXTM3U\n#EXTINF:-1 tvg-name="CCTV-1" group-title="央视",CCTV1\nhttps://a.example/cctv1.m3u8\n',
  );
  expect(channels).toHaveLength(1);
  expect(channels[0].name).toBe("CCTV1");
});

test("opens the shell", async () => {
  const app = await open("./App.tsx", { width: 1280, height: 840 });
  await app.waitFor("设置");
  expect(app.shows("TVGo")).toBe(true);
});

test("moves between the shell's pages", async () => {
  const app = await open("./App.tsx", { width: 1280, height: 840 });
  await app.press("搜索 >> nth=0");
  await app.waitFor("搜索全网站点");
  await app.press("直播");
  await app.waitFor("没有直播源");
  await app.press("收藏与历史");
  await app.waitFor("还没有观看记录");
  await app.press("设置");
  await app.waitFor("配置源");
  await app.press("发现");
  await app.waitFor("还没有可浏览的站点");
  expect(app.shows("打开设置")).toBe(true);
});
