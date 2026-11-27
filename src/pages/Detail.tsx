// One title: what the site says about it, its play lines and its episodes.
import { computed, effect, signal, Scroll, Text, View } from "nsh";
import { Button, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import { messageOf } from "../lib/http";
import { nav } from "../nav";
import {
  cachedVodDetail,
  ensureVodDetail,
  findSite,
  historyFor,
  isFavorite,
  recordHistory,
  rememberVodDetail,
  searchNameOnSites,
  toggleFavorite,
} from "../store";
import type { VodDetail } from "../types";
import type { SearchGroup } from "../store";
import { AppButton, Chip, clock, EmptyState, Failure, Poster } from "../ui/kit";

export function Detail(props: { siteKey: string; vodId: string; vodName: string }) {
  const site = findSite(props.siteKey);
  const detail = signal<VodDetail | null>(cachedVodDetail(props.siteKey, props.vodId));
  const loading = signal(detail() === null);
  const error = signal("");
  const revision = signal(0);
  const flagIndex = signal(0);
  const altGroups = signal<SearchGroup[]>([]);
  const altBusy = signal(false);
  let token = 0;

  effect(() => {
    revision();
    if (detail() !== null) return;
    if (!site) {
      error.set("配置里找不到这个站点");
      loading.set(false);
      return;
    }
    const mine = (token += 1);
    loading.set(true);
    error.set("");
    void (async () => {
      try {
        const value = await ensureVodDetail(site, props.vodId);
        if (mine !== token) return;
        rememberVodDetail(value, props.siteKey);
        detail.set(value);
        if (flagIndex() >= value.lines.length) flagIndex.set(0);
      } catch (failure) {
        if (mine === token) error.set(messageOf(failure));
      } finally {
        if (mine === token) loading.set(false);
      }
    })();
  });

  const lines = computed(() => detail()?.lines ?? []);
  const line = computed(() => lines()[flagIndex()] ?? null);
  const episodes = computed(() => line()?.episodes ?? []);
  const watched = () => historyFor(props.siteKey, props.vodId);
  const favorite = () => isFavorite(props.siteKey, props.vodId);

  const summary = (value: VodDetail) => ({
    id: value.id,
    name: value.name,
    pic: value.pic,
    remarks: value.remarks,
    year: value.year,
    area: value.area,
    typeName: value.typeName,
  });

  const start = (nextFlag: number, nextEpisode: number) => {
    const value = detail();
    const selected = value?.lines[nextFlag]?.episodes[nextEpisode];
    if (!value || !selected || !site) return;
    recordHistory({
      siteKey: props.siteKey,
      siteName: site.name,
      vod: summary(value),
      flagIndex: nextFlag,
      epIndex: nextEpisode,
      epName: selected.name,
      url: selected.url,
      position: 0,
      duration: 0,
    });
    nav.push({
      name: "player",
      siteKey: props.siteKey,
      vodId: props.vodId,
      flagIndex: nextFlag,
      epIndex: nextEpisode,
    });
  };

  const resume = () => {
    const entry = watched();
    if (!entry) return;
    nav.push({
      name: "player",
      siteKey: props.siteKey,
      vodId: props.vodId,
      flagIndex: entry.flagIndex,
      epIndex: entry.epIndex,
    });
  };

  const keep = () => {
    const value = detail();
    if (!value || !site) return;
    toggleFavorite(props.siteKey, site.name, summary(value));
  };


  const findSource = async () => {
    const value = detail();
    if (!value) return;
    altBusy.set(true);
    try {
      altGroups.set(await searchNameOnSites(value.name, props.siteKey));
    } finally {
      altBusy.set(false);
    }
  };

  const switchTo = (siteKey: string, vodId: string, vodName: string) => {
    nav.replace({ name: "detail", siteKey, vodId, vodName });
  };
  const metaRow = () => {
    const value = detail();
    if (!value) return "";
    return [value.year, value.area, value.typeName].filter((part) => part && part.length > 0).join(" · ");
  };

  const actions = () => (
    <View class="flex-row items-center gap-2">
      <AppButton
        label={favorite() ? "已收藏" : "收藏"}
        variant={favorite() ? "primary" : "secondary"}
        size="sm"
        onPress={keep}
        disabled={!detail()}
      />
      <If when={!!watched()}>
        <AppButton label="继续观看" size="sm" onPress={resume} />
      </If>
      <AppButton
        label="播放"
        variant="primary"
        size="sm"
        disabled={episodes().length === 0}
        onPress={() => start(flagIndex(), 0)}
      />
    </View>
  );

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader title={detail()?.name ?? props.vodName} detail={site?.name ?? "未知站点"} actions={actions()} />
        <If when={!!error()}>
          <Failure message={error()} onRetry={() => revision.update((value) => value + 1)} />
        </If>
        <If when={loading() && !detail()}>
          <EmptyState title="正在读取详情…" />
        </If>
        <If when={!!detail() && !error()}>
          <Scroll style={{ flex: 1 }}>
            <View style={{ padding: 20, gap: 20 }}>
              <View class="flex-row gap-6">
                <View style={{ width: 180 }}>
                  <Poster src={detail()?.pic ?? ""} />
                </View>
                <View class="flex-1 gap-2">
                  <Text class="text-2xl font-bold text-foreground">{detail()?.name}</Text>
                  <Text class="text-sm text-muted-foreground">{metaRow()}</Text>
                  <If when={!!watched()}>
                    <Text class="text-sm text-primary">
                      {`上次看到 ${watched()?.epName ?? ""} · ${clock(watched()?.position ?? 0)}`}
                    </Text>
                  </If>
                  <If when={!!detail()?.actor}>
                    <Text class="text-sm text-muted-foreground">主演：{detail()?.actor}</Text>
                  </If>
                  <If when={!!detail()?.director}>
                    <Text class="text-sm text-muted-foreground">导演：{detail()?.director}</Text>
                  </If>
                  <Text class="text-sm text-foreground" style={{ numberOfLines: 6 }}>
                    {detail()?.content || "这个站点没有提供简介。"}
                  </Text>
                </View>
              </View>
              <View class="gap-2">
                <Text class="text-sm font-semibold text-foreground">线路</Text>
                <View class="flex-row flex-wrap gap-2">
                  <Each of={lines()} key={(playLine) => playLine.flag}>
                    {(playLine) => (
                      <Chip
                        label={playLine().flag}
                        selected={lines()[flagIndex()]?.flag === playLine().flag}
                        onPress={() => flagIndex.set(lines().findIndex((value) => value.flag === playLine().flag))}
                      />
                    )}
                  </Each>
                </View>
              </View>
              <If when={lines().length === 0}>
                <EmptyState title="没有播放地址" detail="这个站点没有返回可播放的地址，可能需要解析或登录。" />
              </If>
              <If when={lines().length > 0}>
                <View class="gap-3">
                  <View class="flex-row items-center gap-2">
                    <Text class="text-sm font-semibold text-foreground">选集</Text>
                    <Text class="text-xs text-muted-foreground">{episodes().length} 集</Text>
                  </View>
                  <View class="flex-row flex-wrap gap-2">
                    <Each of={episodes()} key={(episode) => `${episode.name}|${episode.url}`}>
                      {(episode, index) => (
                        <Button
                          onPress={() => start(flagIndex(), index())}
                          class="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/70 active:opacity-70"
                        >
                          <Text class="text-xs text-foreground">{episode().name}</Text>
                        </Button>
                      )}
                    </Each>
                  </View>
                </View>
              </If>
              <View class="gap-2">
                <View class="flex-row items-center gap-2">
                  <Text class="text-sm font-semibold text-foreground">换源</Text>
                  <Text class="text-xs text-muted-foreground">在其它站点搜索同名内容</Text>
                  <View class="flex-1" />
                  <AppButton
                    label={altBusy() ? "搜索中…" : "搜索其它站点"}
                    size="sm"
                    disabled={altBusy() || !detail()}
                    onPress={() => void findSource()}
                  />
                </View>
                <If when={altGroups().length > 0}>
                  <View class="gap-3">
                    <Each of={altGroups()} key={(group) => group.siteKey}>
                      {(group) => (
                        <View class="gap-1.5">
                          <Text class="text-xs text-muted-foreground">{group().siteName}</Text>
                          <View class="flex-row flex-wrap gap-2">
                            <Each of={group().items} key={(item) => item.id}>
                              {(item) => (
                                <Button
                                  onPress={() => switchTo(group().siteKey, item().id, item().name)}
                                  class="rounded-md bg-muted px-3 py-1.5 hover:bg-muted/70 active:opacity-70"
                                >
                                  <Text class="text-xs text-foreground">{item().name}</Text>
                                </Button>
                              )}
                            </Each>
                          </View>
                        </View>
                      )}
                    </Each>
                  </View>
                </If>
              </View>
            </View>
          </Scroll>
        </If>
      </View>
    </NavPage>
  );
}
