import { Platform } from 'react-native';
import { ExperimentalStack, Slot, usePathname } from 'expo-router';
import { AppShell } from '@oxy.so/bloom/app-shell';
import { stackSceneLayout } from '@oxy.so/bloom/panel-routing/expo-router';
import { AtlasNavigation, useAtlasSidebar } from '@/components/navigation';

const IS_WEB = Platform.OS === 'web';

/**
 * The store's frame is Bloom's app shell, and nothing here positions anything.
 *
 * `AtlasNavigation` declares the destinations once; under it the shell draws the
 * sidebar (desktop, tablet rail, the drawer) and the phone's tab bar from them,
 * and decides from its own measured width which one is showing. There is no
 * breakpoint in this app.
 *
 * One panel, `main`, holds the routes. Web renders them through `<Slot/>` so the
 * DOCUMENT is the scroller (each route is a Bloom `Screen` with `scroll="auto"`);
 * native keeps a real stack for push/pop, Android's predictive back and restored
 * scroll, its scenes laid out by Bloom's `stackSceneLayout`.
 */
export default function AppLayout() {
  return (
    <AtlasNavigation>
      <AtlasShell />
    </AtlasNavigation>
  );
}

function AtlasShell() {
  const sidebar = useAtlasSidebar();
  const pathname = usePathname();

  return (
    <AppShell
      testID="atlas-shell"
      scroll="page"
      sidebar={sidebar}
      header={null}
      // The store is a wide page, not a reading column: the panel takes all the
      // room the sidebar leaves, as the desktop store's content does.
      contentMaxWidth="none"
      // The phone's tab bar is the shell's own, drawn from the destinations.
      bottomBarVisibility="compact"
      panelLayout={{
        mode: 'split',
        flow: IS_WEB ? 'document' : 'bounded',
        activePanel: 'main',
        panels: [
          {
            id: 'main',
            // A screen that throws fails inside its panel; navigating recovers it.
            errorBoundary: { resetKey: pathname },
            // The router's navigator keeps one host across every layout change.
            keepMounted: true,
            resizable: false,
            content: IS_WEB ? (
              <Slot />
            ) : (
              <ExperimentalStack
                screenOptions={{ headerShown: false }}
                screenLayout={stackSceneLayout}
              >
                {/* The three pages, as one stack screen: everything else is
                    pushed over them, so Back returns to the page it left. */}
                <ExperimentalStack.Screen name="(tabs)" />
              </ExperimentalStack>
            ),
          },
        ],
      }}
    />
  );
}
