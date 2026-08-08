import { Platform, View } from 'react-native';
import { Slot, Stack } from 'expo-router';
import { ContentPanel } from '@oxyhq/bloom/content-panel';
import { useTheme } from '@oxyhq/bloom/theme';
import { BottomBar, SideRail } from '@/components/app-shell';

const IS_WEB = Platform.OS === 'web';

/**
 * The visual shell: a rail, then the route inside a floating `ContentPanel`,
 * centred and width-capped.
 *
 * The cap is the point. Without it a store on a 27-inch monitor stretches every
 * row edge to edge and reads as a spreadsheet; 950 is where Mention puts it, and
 * matching it means the two feel like one product rather than two that happen to
 * share a palette.
 *
 * ## Responsive with CSS, not with JavaScript
 *
 * Every breakpoint here is a NativeWind class, so on web the browser resolves a
 * media query and resizing costs nothing. Reading `useWindowDimensions` instead
 * re-renders this whole subtree on every resize frame, which is what makes a
 * window drag feel like it is catching. `hidden rail:flex` / `rail:hidden` also
 * means both the rail and the bar are in the tree and CSS picks one — no branch
 * that has to re-run to swap them.
 *
 * Bloom's `ContentPanel` is built the same way (its own docs: "driven purely by
 * NativeWind"), and `framedFrom={500}` lines its framing up with `rail:`.
 *
 * Web renders the route through `<Slot/>` so the DOCUMENT is the scroller and
 * sticky positioning works — a `<Stack>`'s viewport-clamped scene would break
 * both. Native keeps `<Stack>` for real push/pop and restored scroll.
 */
export default function AppLayout() {
  const theme = useTheme();

  return (
    <>
      <View className="flex-1 w-full flex-col rail:flex-row rail:justify-center bg-background">
        <SideRail />

        <View className="flex-1 flex-col bg-background rail:max-w-[950px] rail:shrink">
          {/* The gutter band the panel floats in. `pl-0` so the panel meets the
              rail flush rather than leaving a seam. */}
          <View className="flex-1 bg-background web:rail:p-2 web:rail:pl-0">
            <ContentPanel
              framedFrom={500}
              maskColor={theme.colors.background}
              // The bar is `position: fixed` on mobile web, so it takes no
              // document space and the last row would sit under it. A class
              // cannot express this — it is a prop on somebody else's
              // component — so it stays the one measured value here.
              contentClassName={IS_WEB ? 'pb-14 rail:pb-0' : undefined}
            >
              {IS_WEB ? (
                <Slot />
              ) : (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { flex: 1, backgroundColor: 'transparent' },
                  }}
                />
              )}
            </ContentPanel>
          </View>
        </View>
      </View>

      <BottomBar />
    </>
  );
}
