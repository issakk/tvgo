// Search: one word, every site that offers search, grouped by site.
import { signal, Scroll, Text, View } from "nsh";
import { Button, Input, NavPage } from "nsh/base";
import { PageHeader } from "../components/PageHeader";
import { nav } from "../nav";
import { configSites, searchAll, searchResults } from "../store";
import type { VodItem } from "../types";
import { AppButton, Busy, EmptyState, Poster } from "../ui/kit";

export function Search() {
  const draft = signal(searchResults().keyword);
  const state = () => searchResults();

  const submit = () => {
    const word = draft().trim();
    if (!word) return;
    void searchAll(word);
  };

  const openTitle = (siteKey: string, item: VodItem) => {
    nav.push({ name: "detail", siteKey, vodId: item.id, vodName: item.name });
  };

  const resultCount = () => state().groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <NavPage headerVisible={false}>
      <View class="flex-1">
        <PageHeader
          title="搜索"
          detail={`${configSites().filter((site) => site.searchable !== 0).length} 个站点参与搜索`}
          back={false}
        />
        <View class="flex-row items-center gap-2 px-5 py-3">
          <Input
            value={draft()}
            onChange={(event) => draft.set(event.value)}
            onSubmit={submit}
            placeholder="片名、演员、导演…（Ctrl+K 打开搜索）"
            autoFocus
            class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <AppButton
            label={state().busy ? "搜索中…" : "搜索"}
            variant="primary"
            disabled={state().busy || !draft().trim()}
            onPress={submit}
          />
        </View>
        <If when={state().busy}>
          <Busy label={`正在搜索 ${state().done}/${state().total} 个站点…`} />
        </If>
        <If when={!state().busy && !!state().error}>
          <Text class="px-5 text-sm text-muted-foreground">{state().error}</Text>
        </If>
        <If when={!state().busy && state().keyword !== "" && state().groups.length === 0 && !state().error}>
          <EmptyState title="没有找到结果" detail={`“${state().keyword}”在这些站点里都没有结果。`} />
        </If>
        <If when={state().keyword === ""}>
          <EmptyState title="搜索全网站点" detail="输入片名，TVGo 会同时查询当前配置里支持的站点。" />
        </If>
        <If when={state().groups.length > 0}>
          <Scroll style={{ flex: 1 }}>
            <View style={{ padding: 20, gap: 22 }}>
              <Text class="text-xs text-muted-foreground">
                {`“${state().keyword}” 在 ${state().groups.length} 个站点找到 ${resultCount()} 个结果`}
              </Text>
              <Each of={state().groups} key={(group) => group.siteKey}>
                {(group) => (
                  <View class="gap-3">
                    <View class="flex-row items-center gap-2">
                      <Text class="text-sm font-semibold text-foreground truncate">{group().siteName}</Text>
                      <Text class="text-xs text-muted-foreground">{group().items.length} 个</Text>
                      <If when={!!group().error}>
                        <Text class="text-xs text-destructive">{group().error}</Text>
                      </If>
                    </View>
                    <View class="flex-row flex-wrap gap-3">
                      <Each of={group().items} key={(item) => item.id}>
                        {(item) => (
                          <Button
                            onPress={() => openTitle(group().siteKey, item())}
                            class="rounded-lg p-1 hover:bg-muted/50 active:opacity-75"
                            style={{ width: 124, flexDirection: "column", alignItems: "stretch", gap: 4 }}
                          >
                            <Poster src={item().pic} />
                            <Text class="text-xs font-medium text-foreground truncate">{item().name}</Text>
                            <Text class="text-xs text-muted-foreground truncate">{item().remarks || " "}</Text>
                          </Button>
                        )}
                      </Each>
                    </View>
                  </View>
                )}
              </Each>
            </View>
          </Scroll>
        </If>
      </View>
    </NavPage>
  );
}
