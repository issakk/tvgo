// The navigation stack's state and the shell's root routes.
import { createNavStack } from "nsh/base";

/** The routes that replace the whole stack. */
export type RootName = "discover" | "search" | "live" | "library" | "settings";

export type Route =
  | { name: "discover" }
  | { name: "search" }
  | { name: "live" }
  | { name: "library" }
  | { name: "settings" }
  | { name: "detail"; siteKey: string; vodId: string; vodName: string }
  | { name: "player"; siteKey: string; vodId: string; flagIndex: number; epIndex: number };

export const nav = createNavStack<Route>([{ name: "discover" }]);

/** The root page's name, which the sidebar highlights. */
export function rootName(): RootName {
  const name = nav.routes()[0]?.name;
  switch (name) {
    case "search":
    case "live":
    case "library":
    case "settings":
      return name;
    default:
      return "discover";
  }
}

/** Shows one of the shell's pages, dropping whatever was pushed over it. */
export function goRoot(name: RootName): void {
  switch (name) {
    case "discover":
      nav.setRoutes([{ name: "discover" }]);
      break;
    case "search":
      nav.setRoutes([{ name: "search" }]);
      break;
    case "live":
      nav.setRoutes([{ name: "live" }]);
      break;
    case "library":
      nav.setRoutes([{ name: "library" }]);
      break;
    case "settings":
      nav.setRoutes([{ name: "settings" }]);
      break;
  }
}
