// The data layer's pure parts, and the shell's first frame.
import { expect, open, test } from "nsh/test";
import { parsePlayLines } from "./src/lib/cms";
import { parseConfigDocument } from "./src/lib/config";
import { parseLiveChannels } from "./src/lib/live";

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
