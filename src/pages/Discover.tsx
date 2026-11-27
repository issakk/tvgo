// Discovery: the active site's categories and its latest titles, paged as the list scrolls.
import { effect, signal, List, Scroll, Text, View } from "nsh";
import { Button, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import { loadCategories, loadPage } from "../lib/cms";
import { messageOf } from "../lib/http";
import { goRoot, nav } from "../nav";
import { configSites, currentSite, historyEntries, isReady, selectSite } from "../store";
import type { Category, VodItem } from "../types";
import { AppButton, Busy, Chip, EmptyState, Failure, Poster } from "../ui/kit";

export function Discover() {
  const categories = signal<Category[]>([]);
  const items = signal<VodItem[]>([]);
  const page = signal(1);
  const pageCount = signal(1);
  const loading = signal(false);
  const error = signal("");
  const revision = signal(0);
  // The category the user picked, remembered with the site it belongs to.
  const chosen = signal<{ siteKey: string; typeId: string }>({ siteKey: "", typeId: "" });
  let token = 0;

  const activeTypeId = () => {
    const site = currentSite();
    const pick = chosen();
    if (!site || pick.siteKey !== site.key) return "";
    return pick.typeId;
  };

  effect(() => {
    const site = currentSite();
    const pick = chosen();
    revision();
    if (!site) {
      categories.set([]);
      items.set([]);
      error.set("");
      return;
    }
    const typeId = pick.siteKey === site.key ? pick.typeId : "";
    const mine = (token += 1);
    loading.set(true);
    error.set("");
    void (async () => {
      try {
        const found = await loadCategories(site);
        if (mine !== token) return;
        categories.set(found);
        const first = await loadPage(site, typeId || found[0]?.id || "", 1);
        if (mine !== token) return;
        items.set(first.items);
        page.set(first.page);
        pageCount.set(first.pageCount);
      } catch (failure) {
        if (mine !== token) return;
        items.set([]);
        error.set(messageOf(failure));
      } finally {
        if (mine === token) loading.set(false);
      }
    })();
  });

  const loadMore = async () => {
    const site = currentSite();
    if (!site || loading() || page() >= pageCount()) return;
    const mine = token;
    loading.set(true);
    try {
      const next = await loadPage(site, activeTypeId() || categories()[0]?.id || "", page() + 1);
      if (mine !== token) return;
      items.update((list) => [...list, ...next.items]);
      page.set(next.page);
      pageCount.set(next.pageCount);
    } catch (failure) {
      if (mine === token) error.set(messageOf(failure));
    } finally {
      if (mine === token) loading.set(false);
    }
  };

  const openTitle = (item: VodItem) => {
    const site = currentSite();
    if (!site) return;
    nav.push({ name: "detail", siteKey: site.key, vodId: item.id, vodName: item.name });
  };

  const pickCategory = (typeId: string) => {
    const site = currentSite();
    if (!site) return;
    chosen.set({ siteKey: site.key, typeId });
  };

  const headerActions = () => (
    <View class="flex-row items-center gap-2">
      <AppButton label="刷新" size="sm" onPress={() => revision.update((value) => value + 1)} />
      <AppButton label="搜索" size="sm" variant="primary" onPress={() => goRoot("search")} />
    </View>
  );


  const recentHistory = () => historyEntries().slice(0, 4);

  const resumeEntry = (entryId: string) => {
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

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader
          title={currentSite()?.name ?? "发现"}
          detail={currentSite() ? `${items().length} 个内容 · 第 ${page()} / ${pageCount()} 页` : "还没有站点"}
          actions={headerActions()}
        />
        <View class="flex-1 flex-row">
          <View class="w-48 border-r border-border">
            <Scroll style={{ flex: 1 }}>
              <View class="gap-1 p-2">
                <Each of={configSites()} key={(site) => site.key}>
                  {(site) => (
                    <Button
                      onPress={() => selectSite(site().key)}
                      selected={currentSite()?.key === site().key}
                      class="rounded-md px-3 py-2 hover:bg-muted/60 active:opacity-70 selected:bg-muted"
                    >
                      <Text class="text-sm text-foreground truncate">{site().name}</Text>
                    </Button>
                  )}
                </Each>
              </View>
            </Scroll>
          </View>
          <View class="flex-1">
            <If when={recentHistory().length > 0 && !!currentSite()}>
              <View class="gap-2 border-b border-border px-4 py-3">
                <View class="flex-row items-center gap-2">
                  <Text class="text-xs font-medium text-muted-foreground">继续观看</Text>
                  <View class="flex-1" />
                  <AppButton label="全部" size="sm" variant="ghost" onPress={() => goRoot("library")} />
                </View>
                <View class="flex-row flex-wrap gap-2">
                  <Each of={recentHistory()} key={(entry) => entry.id}>
                    {(entry) => (
                      <Button
                        onPress={() => resumeEntry(entry().id)}
                        class="rounded-lg border border-border p-1.5 hover:bg-muted/50 active:opacity-75"
                        style={{ width: 168, flexDirection: "row", alignItems: "center", gap: 8 }}
                      >
                        <View style={{ width: 32 }}>
                          <Poster src={entry().vod.pic} />
                        </View>
                        <View class="flex-1 gap-0.5">
                          <Text class="text-xs font-medium text-foreground truncate">{entry().vod.name}</Text>
                          <Text class="text-xs text-muted-foreground truncate">
                            {`${entry().epName} · ${entry().siteName}`}
                          </Text>
                        </View>
                      </Button>
                    )}
                  </Each>
                </View>
              </View>
            </If>
            <If when={!isReady()}>
              <Busy label="正在读取保存的配置…" />
            </If>
            <If when={isReady() && !currentSite()}>
              <If when={configSites().length === 0}>
                <EmptyState
                  title="还没有可浏览的站点"
                  detail="在设置里添加一个 TVBox 兼容的配置地址，就能开始浏览。"
                  action={
                    <AppButton label="打开设置" variant="primary" onPress={() => goRoot("settings")} />
                  }
                />
              </If>
              <If when={configSites().length > 0}>
                <EmptyState
                  title="这个配置没有可用站点"
                  detail="站点需要 Spider 或外部应用，Windows 版暂不支持。"
                />
              </If>
            </If>
            <If when={!!currentSite()}>
              <View class="flex-row flex-wrap gap-2 border-b border-border px-4 py-2">
                <Each of={categories()} key={(category) => category.id}>
                  {(category) => (
                    <Chip
                      label={category().name}
                      selected={activeTypeId() === category().id || (activeTypeId() === "" && categories()[0]?.id === category().id)}
                      onPress={() => pickCategory(category().id)}
                    />
                  )}
                </Each>
              </View>
              <If when={!!error()}>
                <Failure message={error()} onRetry={() => revision.update((value) => value + 1)} />
              </If>
              <If when={!error()}>
                <List
                  each={items()}
                  keyExtractor={(item) => item.id}
                  numColumns={5}
                  estimatedItemSize={240}
                  onLoadMore={loadMore}
                  style={{ flex: 1 }}
                  contentStyle={{ padding: 16, gap: 14 }}
                  empty={
                    <If when={!loading()}>
                      <EmptyState title="这个分类还没有内容" detail="换一个分类或站点看看。" />
                    </If>
                  }
                >
                  {(item) => (
                    <Button
                      onPress={() => openTitle(item())}
                      class="rounded-lg p-1.5 hover:bg-muted/50 active:opacity-75"
                      style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
                    >
                      <Poster src={item().pic} />
                      <Text class="text-sm font-medium text-foreground truncate">{item().name}</Text>
                      <Text class="text-xs text-muted-foreground truncate">{item().remarks || item().typeName || " "}</Text>
                    </Button>
                  )}
                </List>
              </If>
              <If when={loading() && items().length > 0}>
                <Busy />
              </If>
            </If>
          </View>
        </View>
      </View>
    </NavPage>
  );
}
