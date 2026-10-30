import { createElement, useMemo, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BloomIconComponent } from '@oxy.so/bloom';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { Button } from '@oxy.so/bloom/button';
import { RiBriefcase4Line } from '@oxy.so/bloom/icons/RiBriefcase4Line';
import { RiChat3Line } from '@oxy.so/bloom/icons/RiChat3Line';
import { RiCodeSSlashLine } from '@oxy.so/bloom/icons/RiCodeSSlashLine';
import { RiCompass3Line } from '@oxy.so/bloom/icons/RiCompass3Line';
import { RiGroupLine } from '@oxy.so/bloom/icons/RiGroupLine';
import { RiHome4Line } from '@oxy.so/bloom/icons/RiHome4Line';
import { RiLayoutGridLine } from '@oxy.so/bloom/icons/RiLayoutGridLine';
import { RiShapesLine } from '@oxy.so/bloom/icons/RiShapesLine';
import { RiSearchFill } from '@oxy.so/bloom/icons/RiSearchFill';
import { RiSearchLine } from '@oxy.so/bloom/icons/RiSearchLine';
import { RiSettings3Fill } from '@oxy.so/bloom/icons/RiSettings3Fill';
import { RiSettings3Line } from '@oxy.so/bloom/icons/RiSettings3Line';
import { RiShoppingBag3Line } from '@oxy.so/bloom/icons/RiShoppingBag3Line';
import { RiSparkling2Line } from '@oxy.so/bloom/icons/RiSparkling2Line';
import { RiToolsLine } from '@oxy.so/bloom/icons/RiToolsLine';
import { RiWallet3Line } from '@oxy.so/bloom/icons/RiWallet3Line';
import { Search } from '@oxy.so/bloom/search';
import type { SidebarProps } from '@oxy.so/bloom/sidebar';
import type { AppDestination } from '@oxy.so/bloom/tab-pager';
import { useTabPager } from '@oxy.so/bloom/tab-pager';
import { TabPagerProvider } from '@oxy.so/bloom/tab-pager/expo-router';
import { ProfileButton, type ProfileButtonProps } from '@oxy.so/services/ui/client';
import { useTranslation } from '@/lib/i18n';
import { useStoreCategories } from '@/lib/store';

/** One entry of the shared account menu, typed from the lean entry (never the root barrel). */
type AccountMenuItem = NonNullable<ProfileButtonProps['menuItems']>[number];

/** Atlas's own icon (#49), the same file the native app icon is built from. */
const ATLAS_ICON: number = require('../assets/images/atlas-icon.png');

/**
 * A glyph per store category, keyed by the category's public slug.
 *
 * The categories are the store's (oxy-api `app_categories`); only their glyph is
 * Atlas's, because the API carries no icon. A category the store adds later
 * still gets a row, drawn with the generic shapes glyph until it gets its own.
 */
const CATEGORY_ICONS: Record<string, BloomIconComponent> = {
  social: RiGroupLine,
  messaging: RiChat3Line,
  productivity: RiBriefcase4Line,
  finance: RiWallet3Line,
  shopping: RiShoppingBag3Line,
  housing: RiHome4Line,
  'developer-tools': RiCodeSSlashLine,
  ai: RiSparkling2Line,
  utilities: RiToolsLine,
};

export function categoryIcon(slug: string): BloomIconComponent {
  return CATEGORY_ICONS[slug] ?? RiShapesLine;
}

/** A category's glyph as an element, for a slot that takes one. */
export function CategoryGlyph({
  slug,
  size,
  color,
}: {
  slug: string;
  size: number;
  color: string;
}) {
  return createElement(categoryIcon(slug), { width: size, height: size, fill: color });
}

/**
 * Every place Atlas's navigation leads, declared once. Bloom draws the rest from
 * it: the pager's pages and the phone's tab bar (Discover, Apps, Search — Search
 * trailing), the sidebar's rows with their selection, and the drawer.
 *
 * Categories and one row per store category follow the pages in the sidebar, as
 * the desktop store lists its catalogue there. They are places, not pages: on a
 * phone they are reached from the Apps page. Settings draws no row; it is the
 * account menu's entry. There is no Updates or Arcade: Atlas installs nothing
 * and sells nothing, and a row with no data behind it would be furniture.
 */
function useAtlasDestinations(): AppDestination[] {
  const { t } = useTranslation();
  const { data: categories } = useStoreCategories();

  return useMemo<AppDestination[]>(
    () => [
      {
        name: 'index',
        href: '/',
        bar: true,
        preload: true,
        label: t('nav.discover'),
        icon: RiCompass3Line,
      },
      {
        name: 'apps',
        href: '/apps',
        bar: true,
        preload: true,
        label: t('nav.apps'),
        icon: RiLayoutGridLine,
      },
      {
        name: 'search',
        href: '/search',
        bar: true,
        label: t('nav.search'),
        icon: RiSearchLine,
        activeIcon: RiSearchFill,
      },
      {
        name: 'categories',
        href: '/categories',
        label: t('nav.categories'),
        icon: RiShapesLine,
      },
      ...(categories ?? []).map((category) => ({
        name: `category:${category.slug}`,
        href: `/category/${category.slug}`,
        label: category.label,
        icon: categoryIcon(category.slug),
      })),
      {
        name: 'settings',
        href: '/settings',
        label: t('nav.settings'),
        icon: RiSettings3Line,
        activeIcon: RiSettings3Fill,
        sidebar: false,
      },
    ],
    [t, categories],
  );
}

/** Bloom's navigation over Atlas's destinations; mounted above the app shell. */
export function AtlasNavigation({ children }: { children: ReactNode }) {
  return <TabPagerProvider destinations={useAtlasDestinations()}>{children}</TabPagerProvider>;
}

/**
 * The search field at the top of the sidebar.
 *
 * It does not search in place: the sidebar is navigation, so submitting takes
 * the query to the Search page, which owns the results. Collapsed to a rail it is
 * a button to the same page.
 */
function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { closeDrawer } = useAppShell();
  const [query, setQuery] = useState('');

  const open = (q: string) => {
    closeDrawer();
    const trimmed = q.trim();
    router.navigate(trimmed ? { pathname: '/search', params: { q: trimmed } } : '/search');
  };

  if (collapsed) {
    return (
      <View className="items-center">
        <Button
          iconOnly
          size="sm"
          appearance="plain"
          tone="neutral"
          leadingIcon={RiSearchLine}
          accessibilityLabel={t('nav.search')}
          onPress={() => open('')}
        />
      </View>
    );
  }

  return (
    <Search
      value={query}
      onChangeText={setQuery}
      onClearText={() => setQuery('')}
      label={t('search.placeholder')}
      returnKeyType="search"
      onSubmitEditing={() => open(query)}
    />
  );
}

/**
 * The account at the foot of the sidebar: the shared Oxy account button, which
 * is the in-app sign-in when nobody is signed in. Atlas's own entry in its menu
 * is Settings.
 */
function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { selectDestination } = useTabPager();
  const { closeDrawer } = useAppShell();

  const menuItems = useMemo<AccountMenuItem[]>(
    () => [
      {
        key: 'atlas-settings',
        label: t('nav.settings'),
        icon: 'cog-outline',
        onPress: () => {
          closeDrawer();
          selectDestination('settings');
        },
      },
    ],
    [t, closeDrawer, selectDestination],
  );

  return <ProfileButton expanded={!collapsed} menuItems={menuItems} />;
}

/** Atlas's mark, sized for the sidebar's 36px logo lane. */
function AtlasMark() {
  return (
    <Image
      source={ATLAS_ICON}
      accessibilityIgnoresInvertColors
      style={{ width: 28, height: 28, borderRadius: 7 }}
    />
  );
}

/**
 * The chrome around the sidebar's rows. The rows themselves and their selection
 * are Atlas's destinations, which Bloom's app shell draws (`AtlasNavigation`).
 */
export function useAtlasSidebar(): SidebarProps {
  const { t } = useTranslation();
  const { selectDestination } = useTabPager();

  return {
    showSearch: false,
    showThemeToggle: false,
    logo: {
      icon: <AtlasMark />,
      wordmark: t('store.title'),
      onPress: () => selectDestination('index'),
    },
    toolbar: ({ collapsed }) => <SidebarSearch collapsed={collapsed} />,
    footer: ({ collapsed }) => <SidebarAccount collapsed={collapsed} />,
  };
}

/**
 * The account at the trailing edge of a page's large title, where the phone
 * store puts it: only while the shell's navigation is a drawer. With the
 * sidebar in flow the account is already at its foot.
 */
export function TitleAccount() {
  const { drawerAvailable } = useAppShell();
  if (!drawerAvailable) return null;
  return <SidebarAccount collapsed />;
}
