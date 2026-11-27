// The app's own styled controls: the only place presentation is chosen.
// Features compose these and never style `nsh/base` controls themselves.
import type { JSX } from "nsh";
import { Image, Text, View } from "nsh";
import { Button, Input } from "nsh/base";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const PADDING: Record<"sm" | "md", string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
};

/** The app's button: a variant and a size, never a color or a radius at the call site. */
export function AppButton(props: {
  label?: string;
  children?: JSX.Element;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  selected?: boolean;
  class?: string;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const variant = () => props.variant ?? "secondary";
  const fill = () => {
    switch (variant()) {
      case "primary":
        return "bg-primary hover:bg-primary/90";
      case "danger":
        return "bg-destructive hover:bg-destructive/90";
      case "ghost":
        return "bg-transparent hover:bg-muted";
      case "outline":
        return "border border-border bg-transparent hover:bg-muted";
      default:
        return "bg-muted hover:bg-muted/70";
    }
  };
  const tint = () => {
    switch (variant()) {
      case "primary":
        return "text-primary-foreground";
      case "danger":
        return "text-white";
      default:
        return "text-foreground";
    }
  };
  return (
    <Button
      onPress={props.onPress}
      disabled={props.disabled}
      selected={props.selected}
      testID={props.testID}
      accessibilityLabel={props.accessibilityLabel}
      class={`flex-row items-center justify-center gap-2 rounded-md active:opacity-75 disabled:opacity-40 ${PADDING[props.size ?? "md"]} ${fill()} ${props.class ?? ""}`}
    >
      {props.children ??
        (props.label === undefined ? null : (
          <Text class={`text-sm font-medium ${tint()}`}>{props.label}</Text>
        ))}
    </Button>
  );
}

/** A selectable pill, for categories, groups and filters. */
export function Chip(props: { label: string; selected?: boolean; onPress?: () => void; class?: string }) {
  return (
    <Button
      onPress={props.onPress}
      selected={props.selected}
      class={`rounded-full px-3 py-1 active:opacity-75 ${props.selected ? "bg-primary" : "bg-muted hover:bg-muted/70"} ${props.class ?? ""}`}
    >
      <Text class={`text-sm ${props.selected ? "text-primary-foreground" : "text-foreground"}`}>{props.label}</Text>
    </Button>
  );
}

/** A poster with the poster's own proportions; the fill shows while it loads. */
export function Poster(props: { src: string; class?: string; style?: { width?: number | string; height?: number | string } }) {
  return (
    <View class={`overflow-hidden rounded-md bg-muted ${props.class ?? ""}`} style={{ aspectRatio: 2 / 3, width: "100%" }}>
      <If when={!!props.src}>
        <Image src={props.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </If>
      <If when={!props.src}>
        <View class="flex-1 items-center justify-center">
          <Text class="text-xs text-muted-foreground">无海报</Text>
        </View>
      </If>
    </View>
  );
}

/** The empty, loading and failure states of a page's region. */
export function EmptyState(props: { title: string; detail?: string; action?: JSX.Element }) {
  return (
    <View class="flex-1 items-center justify-center gap-3 p-10">
      <Text class="text-lg font-semibold text-foreground text-center">{props.title}</Text>
      <If when={!!props.detail}>
        <Text class="text-sm text-muted-foreground text-center">{props.detail}</Text>
      </If>
      {props.action}
    </View>
  );
}

/** A line of feedback while a request runs. */
export function Busy(props: { label?: string }) {
  return (
    <View class="flex-row items-center gap-2 px-2 py-1">
      <Text class="text-xs text-muted-foreground">{props.label ?? "加载中…"}</Text>
    </View>
  );
}

/** A failure with the reason, as a page shows it. */
export function Failure(props: { message: string; onRetry?: () => void }) {
  return (
    <View class="flex-1 items-center justify-center gap-3 p-10">
      <Text class="text-base font-semibold text-destructive text-center">加载失败</Text>
      <Text class="text-sm text-muted-foreground text-center">{props.message}</Text>
      <If when={!!props.onRetry}>
        <AppButton label="重试" size="sm" onPress={props.onRetry} />
      </If>
    </View>
  );
}

/** A group of settings with a title. */
export function Section(props: { title: string; detail?: string; actions?: JSX.Element; children?: JSX.Element }) {
  return (
    <View class="gap-3 border-b border-border pb-6">
      <View class="flex-row items-center gap-3">
        <View class="flex-1 gap-0.5">
          <Text class="text-base font-semibold text-foreground">{props.title}</Text>
          <If when={!!props.detail}>
            <Text class="text-xs text-muted-foreground">{props.detail}</Text>
          </If>
        </View>
        {props.actions}
      </View>
      {props.children}
    </View>
  );
}

/** A labelled text field, the shape settings and forms use. */
export function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  multiline?: boolean;
  class?: string;
  testID?: string;
}) {
  return (
    <View class={`gap-1.5 ${props.class ?? ""}`}>
      <Text class="text-xs font-medium text-muted-foreground">{props.label}</Text>
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.value)}
        onSubmit={() => props.onSubmit?.()}
        placeholder={props.placeholder}
        multiline={props.multiline}
        testID={props.testID}
        class="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
      />
    </View>
  );
}

/** `754` seconds as `12:34`, or `1:02:03` past an hour. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
