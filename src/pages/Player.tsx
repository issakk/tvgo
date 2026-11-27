// Playback: the video, its lines and episodes, keyboard control and where to resume.
import { cleanup, computed, effect, keymap, List, openUrl, signal, Text, Video, View, WebView } from "nsh";
import type { VideoRef } from "nsh";
import { Button, NavPage } from "nsh/base";
import { currentWindow } from "nsh/desktop";
import { PageHeader } from "../components/PageHeader";
import { isWebPageUrl, messageOf } from "../lib/http";
import {
  cachedVodDetail,
  ensureVodDetail,
  findSite,
  historyFor,
  recordHistory,
  rememberVodDetail,
  updateHistoryPosition,
} from "../store";
import type { VodDetail } from "../types";
import { AppButton, Chip, clock, EmptyState, Failure } from "../ui/kit";

const RATES = [1, 1.25, 1.5, 2];

export function Player(props: { siteKey: string; vodId: string; flagIndex: number; epIndex: number }) {
  const site = findSite(props.siteKey);
  const detail = signal<VodDetail | null>(cachedVodDetail(props.siteKey, props.vodId));
  const loading = signal(detail() === null);
  const error = signal("");
  const failure = signal("");
  const revision = signal(0);
  const flagIndex = signal(props.flagIndex);
  const epIndex = signal(props.epIndex);
  const paused = signal(false);
  const rate = signal(1);
  const position = signal(0);
  const duration = signal(0);
  const buffering = signal(false);
  const fullscreen = signal(false);
  const muted = signal(false);
  const win = currentWindow();
  const saved = historyFor(props.siteKey, props.vodId);
  let video!: VideoRef;
  let token = 0;
  let lastSave = 0;
  let resumed = false;

  const lines = computed(() => detail()?.lines ?? []);
  const line = computed(() => lines()[flagIndex()] ?? null);
  const episodes = computed(() => line()?.episodes ?? []);
  const episode = computed(() => episodes()[epIndex()] ?? null);
  const url = computed(() => episode()?.url ?? "");
  const needsBrowser = () => isWebPageUrl(url());
  const title = computed(() => detail()?.name ?? "");

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
      } catch (reason) {
        if (mine === token) error.set(messageOf(reason));
      } finally {
        if (mine === token) loading.set(false);
      }
    })();
  });

  const resumeTarget = () => {
    if (!saved) return 0;
    if (saved.flagIndex !== flagIndex() || saved.epIndex !== epIndex()) return 0;
    return saved.position > 5 ? saved.position : 0;
  };

  const save = (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastSave < 5000) return;
    lastSave = now;
    if (!duration()) return;
    updateHistoryPosition(props.siteKey, props.vodId, position(), duration());
  };

  const togglePause = () => paused.update((value) => !value);

  const seekBy = (delta: number) => {
    const target = Math.max(0, position() + delta);
    position.set(target);
    if (video) video.seek(target);
  };

  // A surface without a window (a test, a browser) has no modes to set.
  const setWindowMode = (mode: "normal" | "fullScreen") => {
    try {
      win.setMode(mode);
    } catch {
      // The surface has no window modes; the player still plays.
    }
  };

  const toggleFullscreen = () => {
    const next = !fullscreen();
    fullscreen.set(next);
    setWindowMode(next ? "fullScreen" : "normal");
  };
  const playEpisode = (nextFlag: number, nextEpisode: number) => {
    const value = detail();
    const selected = value?.lines[nextFlag]?.episodes[nextEpisode];
    if (!value || !selected || !site) return;
    flagIndex.set(nextFlag);
    epIndex.set(nextEpisode);
    position.set(0);
    duration.set(0);
    failure.set("");
    paused.set(false);
    resumed = false;
    lastSave = 0;
    recordHistory({
      siteKey: props.siteKey,
      siteName: site.name,
      vod: {
        id: value.id,
        name: value.name,
        pic: value.pic,
        remarks: value.remarks,
        year: value.year,
        area: value.area,
        typeName: value.typeName,
      },
      flagIndex: nextFlag,
      epIndex: nextEpisode,
      epName: selected.name,
      url: selected.url,
      position: 0,
      duration: 0,
    });
  };

  const nextEpisode = () => {
    const list = episodes();
    if (epIndex() + 1 < list.length) {
      playEpisode(flagIndex(), epIndex() + 1);
      return;
    }
    if (flagIndex() + 1 < lines().length) playEpisode(flagIndex() + 1, 0);
  };

  const previousEpisode = () => {
    if (epIndex() > 0) {
      playEpisode(flagIndex(), epIndex() - 1);
      return;
    }
    if (flagIndex() > 0) {
      const all = lines();
      playEpisode(flagIndex() - 1, Math.max(0, (all[flagIndex() - 1]?.episodes.length ?? 1) - 1));
    }
  };

  keymap.bind("space", togglePause);
  keymap.bind("left", () => seekBy(-10));
  keymap.bind("right", () => seekBy(10));
  keymap.bind("f", toggleFullscreen);
  keymap.bind("n", nextEpisode);
  keymap.bind("b", previousEpisode);
  keymap.bind("m", () => muted.update((value) => !value));

  cleanup(() => {
    save(true);
    setWindowMode("normal");
  });

  const detailLine = () => {
    const parts = [episode()?.name ?? "", site?.name ?? ""];
    return parts.filter((part) => part.length > 0).join(" · ");
  };

  const actions = () => (
    <View class="flex-row items-center gap-2">
      <If when={buffering()}>
        <Text class="text-xs text-muted-foreground">缓冲中…</Text>
      </If>
      <AppButton label="上一集" size="sm" onPress={previousEpisode} disabled={episodes().length === 0} />
      <AppButton label="下一集" size="sm" onPress={nextEpisode} disabled={episodes().length === 0} />
    </View>
  );

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader title={title() || "播放"} detail={detailLine()} actions={actions()} />
        <If when={!!error()}>
          <Failure message={error()} onRetry={() => revision.update((value) => value + 1)} />
        </If>
        <If when={loading() && !detail()}>
          <EmptyState title="正在打开…" />
        </If>
        <If when={!!detail() && !error()}>
          <View class="flex-1 flex-row">
            <View class="flex-1">
              <View class="flex-1" style={{ backgroundColor: "#000000" }}>
                <If when={url() !== "" && needsBrowser()}>
                  <View class="flex-1">
                    <View class="flex-row items-center gap-2 border-b border-border bg-background px-3 py-2">
                      <Text class="text-xs text-muted-foreground">这一集是网页地址，使用内置浏览器打开。</Text>
                      <View class="flex-1" />
                      <AppButton label="用系统浏览器打开" size="sm" onPress={() => void openUrl(url())} />
                    </View>
                    <WebView src={url()} style={{ flex: 1 }} />
                  </View>
                </If>
                <If when={url() !== "" && !needsBrowser()}>
                  <Video
                    ref={video}
                    src={url()}
                    paused={paused()}
                    rate={rate()}
                    muted={muted()}
                    controls
                    style={{ flex: 1 }}
                    onLoad={(event) => {
                      duration.set(event.duration);
                      const target = resumeTarget();
                      if (target > 0 && !resumed) {
                        resumed = true;
                        if (video) video.seek(target);
                      }
                    }}
                    onProgress={(event) => {
                      position.set(event.currentTime);
                      if (event.duration > 0) duration.set(event.duration);
                      save(false);
                    }}
                    onBuffer={(event) => buffering.set(event.isBuffering)}
                    onEnd={nextEpisode}
                    onError={(event) => failure.set(event.message)}
                  />
                </If>
                <If when={url() === ""}>
                  <EmptyState title="这个分类没有播放地址" detail="换一条线路或另一集试试。" />
                </If>
              </View>
              <If when={!needsBrowser()}>
                <View class="flex-row items-center gap-2 border-t border-border bg-background px-3 py-2">
                  <AppButton label={paused() ? "播放" : "暂停"} size="sm" variant="primary" onPress={togglePause} />
                  <AppButton label="-10s" size="sm" onPress={() => seekBy(-10)} />
                  <AppButton label="+10s" size="sm" onPress={() => seekBy(10)} />
                  <AppButton
                    label={muted() ? "取消静音" : "静音"}
                    size="sm"
                    onPress={() => muted.update((value) => !value)}
                  />
                  <Text class="text-xs text-muted-foreground">
                    {`${clock(position())} / ${clock(duration())}`}
                  </Text>
                  <View class="flex-1" />
                  <Each of={RATES} key={(value) => String(value)}>
                    {(value) => (
                      <Chip label={`${value()}x`} selected={rate() === value()} onPress={() => rate.set(value())} />
                    )}
                  </Each>
                  <AppButton label={fullscreen() ? "退出全屏" : "全屏"} size="sm" onPress={toggleFullscreen} />
                </View>
              </If>
            </View>
            <View class="w-72 border-l border-border">
              <View class="gap-1.5 p-3">
                <Text class="text-xs text-muted-foreground">线路</Text>
                <View class="flex-row flex-wrap gap-1.5">
                  <Each of={lines()} key={(playLine) => playLine.flag}>
                    {(playLine) => (
                      <Chip
                        label={playLine().flag}
                        selected={lines()[flagIndex()]?.flag === playLine().flag}
                        onPress={() => playEpisode(lines().findIndex((value) => value.flag === playLine().flag), 0)}
                      />
                    )}
                  </Each>
                </View>
              </View>
              <View class="flex-row items-center gap-2 px-3 pb-1">
                <Text class="text-xs text-muted-foreground">选集</Text>
                <Text class="text-xs text-muted-foreground">{`${episodes().length} 集`}</Text>
              </View>
              <List
                each={episodes()}
                keyExtractor={(value) => `${value.name}|${value.url}`}
                estimatedItemSize={34}
                style={{ flex: 1 }}
                contentStyle={{ padding: 8, gap: 2 }}
              >
                {(value, index) => (
                  <Button
                    onPress={() => playEpisode(flagIndex(), index())}
                    selected={epIndex() === index()}
                    class="rounded-md px-2 py-1.5 hover:bg-muted/60 active:opacity-70 selected:bg-muted"
                  >
                    <Text class="text-xs text-foreground truncate">{value().name}</Text>
                  </Button>
                )}
              </List>
            </View>
          </View>
        </If>
        <If when={!!failure()}>
          <Text class="px-4 py-2 text-sm text-destructive">{`播放失败：${failure()}`}</Text>
        </If>
      </View>
    </NavPage>
  );
}
