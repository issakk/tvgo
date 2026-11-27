// Live TV: the configuration's playlists, their groups and channels, and the player.
import { computed, effect, signal, List, Scroll, Text, Video, View } from "nsh";
import { Button, Input, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import { fetchText, messageOf } from "../lib/http";
import { liveGroups, parseLiveChannels } from "../lib/live";
import { goRoot } from "../nav";
import { liveSources } from "../store";
import type { LiveChannel } from "../types";
import { AppButton, Busy, Chip, EmptyState, Failure } from "../ui/kit";

export function Live() {
  const sources = computed(() => liveSources());
  const sourceIndex = signal(0);
  const channels = signal<LiveChannel[]>([]);
  const loading = signal(false);
  const error = signal("");
  const group = signal("");
  const query = signal("");
  const playing = signal<LiveChannel | null>(null);
  const revision = signal(0);
  let token = 0;

  const source = computed(() => sources()[sourceIndex()] ?? sources()[0] ?? null);
  const groups = computed(() => liveGroups(channels()));
  const visible = computed(() => {
    const filter = group();
    const word = query().trim().toLowerCase();
    return channels().filter(
      (channel) =>
        (filter === "" || channel.group === filter) &&
        (word === "" || channel.name.toLowerCase().includes(word)),
    );
  });

  effect(() => {
    const current = source();
    revision();
    if (!current) {
      channels.set([]);
      playing.set(null);
      return;
    }
    const mine = (token += 1);
    loading.set(true);
    error.set("");
    void (async () => {
      try {
        const text = await fetchText(current.url, 30000);
        if (mine !== token) return;
        const parsed = parseLiveChannels(text);
        if (parsed.length === 0) throw new Error("播放列表里没有频道");
        channels.set(parsed);
        group.set("");
        playing.set(parsed[0] ?? null);
      } catch (reason) {
        if (mine !== token) return;
        channels.set([]);
        playing.set(null);
        error.set(messageOf(reason));
      } finally {
        if (mine === token) loading.set(false);
      }
    })();
  });

  const actions = () => (
    <View class="flex-row items-center gap-2">
      <AppButton label="刷新" size="sm" onPress={() => revision.update((value) => value + 1)} />
      <If when={sources().length === 0}>
        <AppButton label="打开设置" size="sm" variant="primary" onPress={() => goRoot("settings")} />
      </If>
    </View>
  );

  const headerDetail = () => {
    const current = source();
    if (!current) return "配置里没有直播源";
    return `${current.name} · ${visible().length} 个频道`;
  };
  const moveChannel = (delta: number) => {
    const list = visible();
    if (list.length === 0) return;
    const current = playing();
    const index = current ? list.findIndex((channel) => channel.id === current.id) : -1;
    const next = index < 0 ? 0 : (index + delta + list.length) % list.length;
    playing.set(list[next]);
  };


  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader title="直播" detail={headerDetail()} actions={actions()} back={false} />
        <If when={sources().length === 0}>
          <EmptyState
            title="没有直播源"
            detail="这个配置没有声明直播源，或者还没有添加配置。"
            action={<AppButton label="打开设置" variant="primary" onPress={() => goRoot("settings")} />}
          />
        </If>
        <If when={sources().length > 0}>
          <View class="flex-1 flex-row">
            <View class="w-72 border-r border-border">
              <If when={sources().length > 1}>
                <View class="flex-row flex-wrap gap-1.5 border-b border-border p-2">
                  <Each of={sources()} key={(value) => value.url}>
                    {(value, index) => (
                      <Chip
                        label={value().name}
                        selected={source()?.url === value().url}
                        onPress={() => sourceIndex.set(index())}
                      />
                    )}
                  </Each>
                </View>
              </If>
              <View class="border-b border-border p-2">
                <Input
                  value={query()}
                  onChange={(event) => query.set(event.value)}
                  placeholder="筛选频道"
                  class="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                />
              </View>
              <If when={loading() && channels().length === 0}>
                <Busy label="正在读取直播列表…" />
              </If>
              <If when={!!error()}>
                <Failure message={error()} onRetry={() => revision.update((value) => value + 1)} />
              </If>
              <If when={channels().length > 0}>
                <Scroll style={{ maxHeight: 128 }}>
                  <View class="flex-row flex-wrap gap-1.5 border-b border-border p-2">
                    <Chip label="全部" selected={group() === ""} onPress={() => group.set("")} />
                    <Each of={groups()} key={(value) => value.name}>
                      {(value) => (
                        <Chip
                          label={`${value().name} ${value().count}`}
                          selected={group() === value().name}
                          onPress={() => group.set(value().name)}
                        />
                      )}
                    </Each>
                  </View>
                </Scroll>
                <List
                  each={visible()}
                  keyExtractor={(channel) => channel.id}
                  estimatedItemSize={36}
                  style={{ flex: 1 }}
                  contentStyle={{ padding: 6, gap: 2 }}
                >
                  {(channel) => (
                    <Button
                      onPress={() => playing.set(channel())}
                      selected={playing()?.id === channel().id}
                      class="rounded-md px-2 py-1.5 hover:bg-muted/60 active:opacity-70 selected:bg-muted"
                    >
                      <Text class="text-sm text-foreground truncate">{channel().name}</Text>
                    </Button>
                  )}
                </List>
              </If>
            </View>
            <View class="flex-1">
              <View class="flex-row items-center gap-2 border-b border-border px-4 py-2">
                <Text class="text-sm font-semibold text-foreground truncate">
                  {playing()?.name ?? "选择一个频道"}
                </Text>
                <Text class="text-xs text-muted-foreground truncate">{playing()?.group ?? ""}</Text>
                <View class="flex-1" />
                <AppButton label="上一个" size="sm" onPress={() => moveChannel(-1)} disabled={visible().length === 0} />
                <AppButton label="下一个" size="sm" onPress={() => moveChannel(1)} disabled={visible().length === 0} />
              </View>
              <View class="flex-1" style={{ backgroundColor: "#000000" }}>
                <If when={!!playing()}>
                  <Video src={playing()?.url ?? ""} controls style={{ flex: 1 }} />
                </If>
                <If when={!playing()}>
                  <EmptyState title="还没有选择频道" detail="在左边选一个分组和频道。" />
                </If>
              </View>
            </View>
          </View>
        </If>
      </View>
    </NavPage>
  );
}
