import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Avatar } from '@oxy.so/bloom/avatar';
import { useAuth } from '@oxy.so/services';
import { useTranslation } from '@/lib/i18n';

/**
 * The app shell: a rail from `rail:` up, a bar below it.
 *
 * Both are always mounted and CSS chooses — `hidden rail:flex` on one,
 * `rail:hidden` on the other. That is deliberate: a JS width read would
 * re-render this subtree on every resize frame, and swapping components on a
 * boolean makes a window drag feel like it is catching. The breakpoints are
 * `--breakpoint-rail` / `--breakpoint-wide` in `global.css`.
 *
 * The same reasoning applies to the rail's labels: they are `hidden wide:flex`
 * rather than a second measured branch.
 */

interface Destination {
  href: '/' | '/settings';
  labelKey: string;
  glyph: string;
}

/**
 * Two destinations, and that is the whole app: a store you browse and the
 * settings behind it. A tab bar for two things is honest; a drawer would be
 * furniture.
 */
const DESTINATIONS: Destination[] = [
  { href: '/', labelKey: 'nav.store', glyph: '◳' },
  { href: '/settings', labelKey: 'nav.settings', glyph: '⚙' },
];

function useIsActive(href: string): boolean {
  const pathname = usePathname();
  // The store owns every app page under it, so `/app/mention` keeps the store
  // tab lit rather than lighting nothing.
  return href === '/' ? pathname === '/' || pathname.startsWith('/app/') : pathname === href;
}

/** The desktop rail. Hidden below `RAIL_BREAKPOINT`, where the bottom bar takes over. */
export function SideRail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  return (
    <View className="hidden rail:flex h-full items-end px-2 py-3 w-[76px] wide:w-60">
      <View className="w-full gap-1 max-w-[60px] wide:max-w-[220px]">
        <View className="mb-2 flex-row items-center gap-3 px-3 py-2">
          <Text className="text-2xl">◳</Text>
          <Text className="hidden wide:flex text-xl font-bold text-foreground">
            {t('store.title')}
          </Text>
        </View>

        {DESTINATIONS.map((destination) => (
          <RailItem
            key={destination.href}
            destination={destination}
            onPress={() => router.push(destination.href)}
          />
        ))}

        {isAuthenticated ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            className="mt-2 flex-row items-center gap-3 rounded-full px-3 py-2 active:opacity-70"
          >
            <Avatar source={user?.avatar} variant="thumb" size={28} name={user?.username ?? ''} />
            <Text className="hidden wide:flex flex-1 text-sm text-foreground" numberOfLines={1}>
              {user?.name?.displayName?.trim() || user?.username}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RailItem({ destination, onPress }: { destination: Destination; onPress: () => void }) {
  const { t } = useTranslation();
  const active = useIsActive(destination.href);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={
        active
          ? 'flex-row items-center gap-3 rounded-full bg-card px-3 py-2.5'
          : 'flex-row items-center gap-3 rounded-full px-3 py-2.5 active:opacity-70'
      }
    >
      <Text className={active ? 'text-xl text-foreground' : 'text-xl opacity-60'}>
        {destination.glyph}
      </Text>
      <Text
        className={
          active
            ? 'hidden wide:flex text-base font-semibold text-foreground'
            : 'hidden wide:flex text-base text-foreground/70'
        }
      >
        {t(destination.labelKey)}
      </Text>
    </Pressable>
  );
}

/**
 * The mobile bar.
 *
 * `position: fixed` on web so it takes no document-scroll space, which is what
 * lets the page body stay the scroller — the same reason Mention's does it, and
 * why screens reserve its height as bottom padding rather than shrinking.
 */
export function BottomBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row rail:hidden border-t border-border bg-background"
      style={[
        { paddingBottom: insets.bottom },
        Platform.OS === 'web'
          ? ({ position: 'fixed', left: 0, right: 0, bottom: 0 } as never)
          : null,
      ]}
    >
      {DESTINATIONS.map((destination) => (
        <BottomBarItem
          key={destination.href}
          destination={destination}
          onPress={() => router.push(destination.href)}
        />
      ))}
    </View>
  );
}

function BottomBarItem({ destination, onPress }: { destination: Destination; onPress: () => void }) {
  const { t } = useTranslation();
  const active = useIsActive(destination.href);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="flex-1 items-center gap-0.5 py-2.5 active:opacity-70"
    >
      <Text className={active ? 'text-xl text-foreground' : 'text-xl opacity-50'}>
        {destination.glyph}
      </Text>
      <Text
        className={active ? 'text-xs font-semibold text-foreground' : 'text-xs text-foreground/60'}
      >
        {t(destination.labelKey)}
      </Text>
    </Pressable>
  );
}
