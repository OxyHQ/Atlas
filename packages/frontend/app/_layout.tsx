// Tailwind v4 + NativeWind entry. Importing it here is what makes react-native-css
// compile the utility stylesheet for the web build, so className layout utilities
// (from this app and @oxy.so/services) render on web instead of falling through to
// react-native-web's base View reset. Pairs with postcss.config.mjs.
import '../global.css';

import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OxyProvider, useAccountColor, useOxy } from '@oxy.so/services/ui/client';
import { BloomThemeProvider } from '@oxy.so/bloom/theme';
import { ImageResolverProvider } from '@oxy.so/bloom/image-resolver';
import { ConnectionStatusToasts } from '@oxy.so/bloom/connection-status';
import { OverlayInertBoundary, PortalOutlet, PortalProvider } from '@oxy.so/bloom/portal';
import { API_URL, OXY_CLIENT_ID } from '@/lib/config';
import { ATLAS_ACCOUNT_QUERIES, queryClient } from '@/lib/queryClient';
import { THEME_PERSIST_KEY, themeStorage } from '@/lib/themePersistence';
import { LocaleProvider } from '@/lib/i18n';
import { ErrorFallback } from '@/components/error-fallback';

/**
 * Top-level error boundary. expo-router renders this whenever a render error
 * escapes a nested route, so an unexpected crash falls back to a branded retry
 * screen instead of a blank white screen.
 */
export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorFallback {...props} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* No KeyboardProvider here: OxyProvider mounts the one. A second one above it
          took the native keyboard events, so every keyboard hook under OxyProvider read
          a closed keyboard. */}
      <SafeAreaProvider>
        {/* BloomThemeProvider is the outermost theming authority — it must wrap
            every render branch, including any pre-auth backdrop. OxyProvider is
            the single session authority (web + native); it owns the QueryClient
            and never redirects to an external login. */}
        <BloomThemeProvider persistKey={THEME_PERSIST_KEY} storage={themeStorage}>
          <ConnectionStatusToasts />
          <OxyProvider
            baseURL={API_URL}
            clientId={OXY_CLIENT_ID}
            queryClient={queryClient}
            accountQueries={ATLAS_ACCOUNT_QUERIES}
          >
            <AppImageResolver>
              <LocaleProvider>
                <AccountColor />
                {/* Native Bloom surfaces (AliaChatSheet's BottomSheet) render only
                    through this provider/outlet pair; the outlet sits AFTER the
                    content it paints over, and the boundary wraps everything else. */}
                <PortalProvider>
                  <OverlayInertBoundary>
                    <AppStack />
                    <StatusBar style="auto" />
                  </OverlayInertBoundary>
                  <PortalOutlet />
                </PortalProvider>
              </LocaleProvider>
            </AppImageResolver>
          </OxyProvider>
        </BloomThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Wears the signed-in account's colour. Mounted once, below both OxyProvider
 * (the session) and BloomThemeProvider (the theme it is applied to).
 */
function AccountColor() {
  useAccountColor();
  return null;
}

/**
 * Registers the Oxy `ImageResolver` so every Bloom `Avatar` resolves a bare file
 * id to a variant-aware URL. Must live inside OxyProvider so `useOxy()` has a
 * client.
 */
function AppImageResolver({ children }: { children: ReactNode }) {
  const { oxyServices } = useOxy();
  return (
    <ImageResolverProvider
      value={(id, variant) => oxyServices.assets.publicUrl(id, variant ?? 'thumb')}
    >
      {children}
    </ImageResolverProvider>
  );
}

/**
 * Atlas has no `(auth)`↔`(app)` swap, and that is the deliberate part.
 *
 * A storefront is what somebody looks at BEFORE they have an account: every
 * read it makes is a public endpoint, and gating the whole app behind a login
 * would hide the catalogue from exactly the people it exists to reach. Signing
 * in is needed only to write a review, and that is an in-app SDK modal opened
 * on demand (`signIn()`), never a redirect to a login screen.
 *
 * So the root Stack has one group and no redirect, and there is no cold-boot
 * blank: the store renders while the session is still resolving.
 */
function AppStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
