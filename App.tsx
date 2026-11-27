// The app shell: the sidebar, the navigation stack and the window.
import { mount, View } from "nsh";
import { Window } from "nsh/desktop";
import { NavStack } from "nsh/base";
import { Sidebar } from "./src/components/Sidebar";
import { nav, type Route } from "./src/nav";
import { Detail } from "./src/pages/Detail";
import { Discover } from "./src/pages/Discover";
import { Library } from "./src/pages/Library";
import { Live } from "./src/pages/Live";
import { Player } from "./src/pages/Player";
import { Search } from "./src/pages/Search";
import { Settings } from "./src/pages/Settings";
import type { JSX } from "nsh";

function screen(route: Route): JSX.Element {
  switch (route.name) {
    case "discover":
      return <Discover />;
    case "search":
      return <Search />;
    case "live":
      return <Live />;
    case "library":
      return <Library />;
    case "settings":
      return <Settings />;
    case "detail":
      return <Detail siteKey={route.siteKey} vodId={route.vodId} vodName={route.vodName} />;
    case "player":
      return (
        <Player
          siteKey={route.siteKey}
          vodId={route.vodId}
          flagIndex={route.flagIndex}
          epIndex={route.epIndex}
        />
      );
    default:
      return <Discover />;
  }
}

function App() {
  return (
    <View class="flex-1 flex-row bg-background">
      <Sidebar />
      <View class="flex-1">
        <NavStack state={nav} style={{ flex: 1 }}>
          {(route) => screen(route)}
        </NavStack>
      </View>
    </View>
  );
}

mount(() => (
  <Window id="main" title="TVGo">
    <App />
  </Window>
));
