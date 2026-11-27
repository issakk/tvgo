// Settings: configuration sources, the sites they name, appearance, data and about.
import { appInfo, openUrl, Scroll, signal, Text, View } from "nsh";
import { AlertDialog, Button, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import {
  activeConfig,
  allConfigs,
  appSettings,
  chooseConfig,
  clearAllData,
  clearFavorites,
  clearHistory,
  configFailure,
  documentSites,
  importConfig,
  importConfigText,
  isConfigBusy,
  refreshConfig,
  removeConfig,
  setSiteEnabled,
  setTheme,
  siteEnabled,
} from "../store";
import type { SiteConfig } from "../types";
import { AppButton, Chip, Field, Section } from "../ui/kit";

const PROJECT_URL = "https://github.com/issakk/tvgo";

function siteKind(site: SiteConfig): string {
  switch (site.type) {
    case 0:
      return "XML CMS";
    case 1:
      return "JSON CMS";
    case 3:
      return "Spider（暂不支持）";
    default:
      return "外部应用（暂不支持）";
  }
}

function siteSupported(site: SiteConfig): boolean {
  return site.type === 0 || site.type === 1;
}

export function Settings() {
  const url = signal("");
  const pasted = signal("");
  const pastedName = signal("");
  const info = appInfo();

  const confirm = async (title: string, label: string): Promise<boolean> => {
    const result = await AlertDialog.show({
      title,
      actions: [
        { id: "cancel", label: "取消", role: "cancel" },
        { id: "ok", label, role: "destructive" },
      ],
    });
    return result.action === "ok";
  };

  const submitUrl = async () => {
    const target = url().trim();
    if (!target) return;
    await importConfig(target);
    if (!configFailure()) url.set("");
  };

  const submitPasted = async () => {
    const text = pasted().trim();
    if (!text) return;
    await importConfigText(text, pastedName());
    if (!configFailure()) {
      pasted.set("");
      pastedName.set("");
    }
  };

  const dropConfig = async (id: string, name: string) => {
    if (await confirm(`删除配置“${name}”？`, "删除")) removeConfig(id);
  };

  const wipe = async (what: "history" | "favorites" | "all") => {
    const titles = {
      history: "清空全部观看记录？",
      favorites: "清空全部收藏？",
      all: "删除全部配置、收藏和观看记录？",
    };
    if (!(await confirm(titles[what], "删除"))) return;
    if (what === "history") clearHistory();
    else if (what === "favorites") clearFavorites();
    else clearAllData();
  };

  const appearance = () => appSettings().theme;

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader title="设置" detail="配置、站点、外观与数据" back={false} />
        <Scroll style={{ flex: 1 }}>
          <View style={{ padding: 20, gap: 24 }}>
            <Section
              title="配置源"
              detail="支持 TVBox 兼容的 JSON 配置。JSON CMS 与 XML CMS 站点可以直接浏览，CSP Spider 站点暂不支持。"
            >
              <View class="gap-2">
                <Field
                  label="配置地址"
                  value={url()}
                  onChange={(value) => url.set(value)}
                  onSubmit={submitUrl}
                  placeholder="https://example.com/tvbox.json"
                />
                <View class="flex-row items-center gap-2">
                  <AppButton
                    label={isConfigBusy() ? "读取中…" : "添加配置"}
                    variant="primary"
                    disabled={isConfigBusy() || !url().trim()}
                    onPress={submitUrl}
                  />
                  <Text class="text-xs text-muted-foreground">
                    {allConfigs().length === 0 ? "还没有添加任何配置" : `已添加 ${allConfigs().length} 个配置`}
                  </Text>
                </View>
                <If when={!!configFailure()}>
                  <Text class="text-xs text-destructive">{configFailure()}</Text>
                </If>
              </View>
              <View class="gap-2">
                <Field
                  label="或粘贴配置 JSON"
                  value={pasted()}
                  onChange={(value) => pasted.set(value)}
                  placeholder='{"sites":[…] }'
                  multiline
                />
                <View class="flex-row items-center gap-2">
                  <Field label="名称（可选）" value={pastedName()} onChange={(value) => pastedName.set(value)} />
                  <AppButton
                    label="导入粘贴的配置"
                    disabled={isConfigBusy() || !pasted().trim()}
                    onPress={submitPasted}
                  />
                </View>
              </View>
              <View class="gap-2">
                <Each of={allConfigs()} key={(source) => source.id}>
                  {(source) => (
                    <View class="flex-row items-center gap-2 rounded-lg border border-border p-2">
                      <View class="flex-1 gap-0.5">
                        <Text class="text-sm font-medium text-foreground truncate">{source().name}</Text>
                        <Text class="text-xs text-muted-foreground truncate">
                          {`${source().url || "粘贴的配置"} · ${source().config.sites.length} 个站点 · ${source().config.lives.length} 个直播源`}
                        </Text>
                      </View>
                      <AppButton
                        label={activeConfig()?.id === source().id ? "当前" : "使用"}
                        size="sm"
                        variant={activeConfig()?.id === source().id ? "primary" : "secondary"}
                        onPress={() => chooseConfig(source().id)}
                      />
                      <AppButton
                        label="刷新"
                        size="sm"
                        disabled={!source().url || isConfigBusy()}
                        onPress={() => void refreshConfig(source().id)}
                      />
                      <AppButton label="删除" size="sm" variant="danger" onPress={() => void dropConfig(source().id, source().name)} />
                    </View>
                  )}
                </Each>
              </View>
            </Section>

            <Section title="站点" detail="关掉的站点不会出现在发现页和搜索结果里。">
              <View class="gap-1.5">
                <Each of={documentSites()} key={(site) => site.key}>
                  {(site) => (
                    <View class="flex-row items-center gap-2 rounded-lg border border-border p-2">
                      <View class="flex-1 gap-0.5">
                        <Text class="text-sm text-foreground truncate">{site().name}</Text>
                        <Text class="text-xs text-muted-foreground truncate">
                          {`${siteKind(site())}${site().hide === 1 ? " · 配置里已隐藏" : ""}`}
                        </Text>
                      </View>
                      <AppButton
                        label={siteEnabled(activeConfig()?.id ?? "", site().key) ? "已启用" : "已停用"}
                        size="sm"
                        variant={siteEnabled(activeConfig()?.id ?? "", site().key) ? "primary" : "secondary"}
                        disabled={!siteSupported(site()) || site().hide === 1}
                        onPress={() =>
                          setSiteEnabled(
                            activeConfig()?.id ?? "",
                            site().key,
                            !siteEnabled(activeConfig()?.id ?? "", site().key),
                          )
                        }
                      />
                    </View>
                  )}
                </Each>
                <If when={documentSites().length === 0}>
                  <Text class="text-xs text-muted-foreground">还没有配置，添加配置后这里会列出它的站点。</Text>
                </If>
              </View>
            </Section>

            <Section title="外观" detail="跟随系统，或固定为浅色、深色。">
              <View class="flex-row gap-2">
                <Chip label="跟随系统" selected={appearance() === "system"} onPress={() => setTheme("system")} />
                <Chip label="浅色" selected={appearance() === "light"} onPress={() => setTheme("light")} />
                <Chip label="深色" selected={appearance() === "dark"} onPress={() => setTheme("dark")} />
              </View>
            </Section>

            <Section title="快捷键" detail="播放页的键盘操作。">
              <View class="gap-1">
                <Text class="text-xs text-muted-foreground">空格：播放 / 暂停</Text>
                <Text class="text-xs text-muted-foreground">← / →：后退 / 前进 10 秒</Text>
                <Text class="text-xs text-muted-foreground">N / B：下一集 / 上一集</Text>
                <Text class="text-xs text-muted-foreground">F：全屏</Text>
                <Text class="text-xs text-muted-foreground">Esc / 返回按钮：退出播放页</Text>
              </View>
            </Section>

            <Section title="数据" detail="这个应用保存在本机的内容。">
              <View class="flex-row flex-wrap gap-2">
                <AppButton label="清空观看记录" size="sm" onPress={() => void wipe("history")} />
                <AppButton label="清空收藏" size="sm" onPress={() => void wipe("favorites")} />
                <AppButton label="清空全部数据" size="sm" variant="danger" onPress={() => void wipe("all")} />
              </View>
            </Section>

            <Section title="关于" detail={`${info.name ?? "TVGo"} ${info.version ?? ""} (${info.build ?? 1})`}>
              <View class="gap-2">
                <Text class="text-xs text-muted-foreground">
                  TVGo 是一个 Windows 桌面电视盒子：多站点浏览、搜索、播放、直播、收藏与历史。播放使用 Windows 自带的 Media Foundation。
                </Text>
                <View class="flex-row items-center gap-2">
                  <Button
                    onPress={() => void openUrl(PROJECT_URL)}
                    class="rounded-md px-2 py-1 active:opacity-70"
                  >
                    <Text class="text-xs text-primary">{PROJECT_URL}</Text>
                  </Button>
                  <Text class="text-xs text-muted-foreground">基于 Native Shell（NSH）构建</Text>
                </View>
              </View>
            </Section>
          </View>
        </Scroll>
      </View>
    </NavPage>
  );
}
