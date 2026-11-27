// The app shell's sidebar: the shell's pages, and what the app is looking at.
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import { goRoot, rootName, type RootName } from "../nav";
import { activeConfig, configSites } from "../store";

interface ShellPage {
  name: RootName;
  label: string;
  glyph: string;
}

const PAGES: ShellPage[] = [
  { name: "discover", label: "发现", glyph: "▤" },
  { name: "search", label: "搜索", glyph: "⌕" },
  { name: "live", label: "直播", glyph: "◉" },
  { name: "library", label: "收藏与历史", glyph: "★" },
  { name: "settings", label: "设置", glyph: "⚙" },
];

export function Sidebar() {
  return (
    <View class="w-52 border-r border-border bg-muted/20 p-3">
      <View class="gap-0.5 px-2 pb-4 pt-2">
        <Text class="text-lg font-bold text-foreground">TVGo</Text>
        <Text class="text-xs text-muted-foreground">Windows 电视盒子</Text>
      </View>
      <View class="gap-1">
        <Each of={PAGES} key={(page) => page.name}>
          {(page) => (
            <Button
              onPress={() => goRoot(page().name)}
              selected={rootName() === page().name}
              class="flex-row items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60 active:opacity-70 selected:bg-muted"
            >
              <Text class="w-4 text-center text-sm text-muted-foreground">{page().glyph}</Text>
              <Text class="text-sm text-foreground">{page().label}</Text>
            </Button>
          )}
        </Each>
      </View>
      <View class="flex-1" />
      <View class="gap-0.5 border-t border-border px-2 pt-3">
        <Text class="text-xs text-muted-foreground truncate">
          {activeConfig()?.name ?? "未添加配置"}
        </Text>
        <Text class="text-xs text-muted-foreground">
          {configSites().length} 个可用站点
        </Text>
      </View>
    </View>
  );
}
