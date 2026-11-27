// The header a page draws on the desktops: back, title, detail and the page's actions.
import type { JSX } from "nsh";
import { Text, View } from "nsh";
import { Button } from "nsh/base";
import { nav } from "../nav";

export function PageHeader(props: { title: string; detail?: string; actions?: JSX.Element; back?: boolean }) {
  const showsBack = () => props.back ?? nav.routes().length > 1;
  return (
    <View class="flex-row items-center gap-3 border-b border-border px-5 py-3">
      <If when={showsBack()}>
        <Button
          onPress={() => nav.pop()}
          accessibilityLabel="返回"
          class="rounded-md px-2 py-1 hover:bg-muted active:opacity-70"
        >
          <Text class="text-base text-muted-foreground">←</Text>
        </Button>
      </If>
      <View class="flex-1 gap-0.5">
        <Text class="text-lg font-semibold text-foreground truncate">{props.title}</Text>
        <If when={!!props.detail}>
          <Text class="text-xs text-muted-foreground truncate">{props.detail}</Text>
        </If>
      </View>
      {props.actions}
    </View>
  );
}
