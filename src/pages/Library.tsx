// What the user kept: playback history to resume and titles kept for later.
import { signal, List, Text, View } from "nsh";
import { AlertDialog, Button, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import { goRoot, nav } from "../nav";
import {
  clearFavorites,
  clearHistory,
  favoriteEntries,
  historyEntries,
  removeFavorite,
  removeHistory,
} from "../store";
import { AppButton, Chip, clock, EmptyState, Poster } from "../ui/kit";

type Tab = "history" | "favorites";

/** Asks before emptying a list the user cannot get back. */
async function confirmClear(title: string, run: () => void): Promise<void> {
  const result = await AlertDialog.show({
    title,
    actions: [
      { id: "cancel", label: "取消", role: "cancel" },
      { id: "ok", label: "清空", role: "destructive" },
    ],
  });
  if (result.action === "ok") run();
}

export function Library() {
  const tab = signal<Tab>("history");

  const resume = (entryId: string) => {
    const entry = historyEntries().find((value) => value.id === entryId);
    if (!entry) return;
    nav.push({
      name: "player",
      siteKey: entry.siteKey,
      vodId: entry.vod.id,
      flagIndex: entry.flagIndex,
      epIndex: entry.epIndex,
    });
  };

  const openDetail = (favoriteId: string) => {
    const entry = favoriteEntries().find((value) => value.id === favoriteId);
    if (!entry) return;
    nav.push({ name: "detail", siteKey: entry.siteKey, vodId: entry.vod.id, vodName: entry.vod.name });
  };

  const actions = () => (
    <View class="flex-row items-center gap-2">
      <AppButton label="历史" size="sm" variant={tab() === "history" ? "primary" : "secondary"} onPress={() => tab.set("history")} />
      <AppButton
        label="收藏"
        size="sm"
        variant={tab() === "favorites" ? "primary" : "secondary"}
        onPress={() => tab.set("favorites")}
      />
    </View>
  );

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader
          title="收藏与历史"
          detail={`${historyEntries().length} 条历史 · ${favoriteEntries().length} 个收藏`}
          actions={actions()}
          back={false}
        />
        <If when={tab() === "history"}>
          <If when={historyEntries().length === 0}>
            <EmptyState
              title="还没有观看记录"
              detail="播放一个内容后，这里会记下看到第几集、看到哪里。"
              action={<AppButton label="去发现" variant="primary" onPress={() => goRoot("discover")} />}
            />
          </If>
          <If when={historyEntries().length > 0}>
            <View class="flex-row items-center gap-2 px-5 py-2">
              <Text class="text-xs text-muted-foreground">继续观看</Text>
              <View class="flex-1" />
              <AppButton label="清空历史" size="sm" variant="outline" onPress={() => void confirmClear("清空全部观看记录？", clearHistory)} />
            </View>
            <List
              each={historyEntries()}
              keyExtractor={(entry) => entry.id}
              estimatedItemSize={72}
              style={{ flex: 1 }}
              contentStyle={{ padding: 12, gap: 6 }}
            >
              {(entry) => (
                <View class="flex-row items-center gap-3 rounded-lg border border-border p-2">
                  <View style={{ width: 44 }}>
                    <Poster src={entry().vod.pic} />
                  </View>
                  <Button
                    onPress={() => resume(entry().id)}
                    class="flex-1 rounded-md p-2 hover:bg-muted/50 active:opacity-70"
                    style={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}
                  >
                    <Text class="text-sm font-medium text-foreground truncate">{entry().vod.name}</Text>
                    <Text class="text-xs text-muted-foreground truncate">
                      {`${entry().siteName} · ${entry().epName} · ${clock(entry().position)}`}
                    </Text>
                  </Button>
                  <AppButton label="继续" size="sm" variant="primary" onPress={() => resume(entry().id)} />
                  <AppButton label="移除" size="sm" variant="ghost" onPress={() => removeHistory(entry().id)} />
                </View>
              )}
            </List>
          </If>
        </If>
        <If when={tab() === "favorites"}>
          <If when={favoriteEntries().length === 0}>
            <EmptyState
              title="还没有收藏"
              detail="在详情页点“收藏”，内容就会出现在这里。"
              action={<AppButton label="去发现" variant="primary" onPress={() => goRoot("discover")} />}
            />
          </If>
          <If when={favoriteEntries().length > 0}>
            <View class="flex-row items-center gap-2 px-5 py-2">
              <Text class="text-xs text-muted-foreground">收藏的内容</Text>
              <View class="flex-1" />
              <AppButton label="清空收藏" size="sm" variant="outline" onPress={() => void confirmClear("清空全部收藏？", clearFavorites)} />
            </View>
            <List
              each={favoriteEntries()}
              keyExtractor={(entry) => entry.id}
              estimatedItemSize={72}
              style={{ flex: 1 }}
              contentStyle={{ padding: 12, gap: 6 }}
            >
              {(entry) => (
                <View class="flex-row items-center gap-3 rounded-lg border border-border p-2">
                  <View style={{ width: 44 }}>
                    <Poster src={entry().vod.pic} />
                  </View>
                  <Button
                    onPress={() => openDetail(entry().id)}
                    class="flex-1 rounded-md p-2 hover:bg-muted/50 active:opacity-70"
                    style={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}
                  >
                    <Text class="text-sm font-medium text-foreground truncate">{entry().vod.name}</Text>
                    <Text class="text-xs text-muted-foreground truncate">
                      {`${entry().siteName} · ${entry().vod.remarks || "收藏"}`}
                    </Text>
                  </Button>
                  <Chip label="详情" onPress={() => openDetail(entry().id)} />
                  <AppButton label="移除" size="sm" variant="ghost" onPress={() => removeFavorite(entry().id)} />
                </View>
              )}
            </List>
          </If>
        </If>
      </View>
    </NavPage>
  );
}
