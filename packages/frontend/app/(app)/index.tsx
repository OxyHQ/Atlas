import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@oxyhq/bloom/button';
import { AppListRow, HeroCard, ShelfTile, ShelfTileSkeleton } from '@/components/store-cards';
import { useTranslation } from '@/lib/i18n';
import { useStoreApps, useStoreCategories, type StoreListingSummary } from '@/lib/store';

/**
 * The storefront, in the App Store's grammar: a hero, then a shelf per
 * category, then everything as a list.
 *
 * Readable signed out — every call it makes is a public endpoint — so there is
 * no session check anywhere on this screen and no blank frame while cold boot
 * resolves.
 *
 * The shelves are grouped in memory from ONE `/store/apps` read rather than a
 * request per category. A store with nine shelves would otherwise open with
 * nine round trips, and the payload it already has carries each app's category.
 *
 * Responsive is CSS: the two-up list is `rail:w-1/2`, not a width read, so
 * resizing is the browser reflowing rather than React re-rendering on every
 * frame.
 */
export default function StoreScreen() {
  const { t } = useTranslation();
  const { data: categories } = useStoreCategories();
  const { data: page, isLoading, isError, refetch } = useStoreApps();

  const items = useMemo(() => page?.items ?? [], [page]);

  // Shelves in the store's curated order, and only the ones with something on
  // them: an empty shelf on a storefront reads as a store that is missing
  // things rather than as a category nobody has published to yet.
  const shelves = useMemo(() => {
    const byCategory = new Map<string, StoreListingSummary[]>();
    for (const item of items) {
      if (!item.category) continue;
      const existing = byCategory.get(item.category.slug);
      if (existing) existing.push(item);
      else byCategory.set(item.category.slug, [item]);
    }
    return (categories ?? [])
      .map((category) => ({ category, apps: byCategory.get(category.slug) ?? [] }))
      .filter((shelf) => shelf.apps.length > 0);
  }, [items, categories]);

  // The hero is the best-reviewed app, falling back to the newest. Whatever it
  // is, it must not appear again immediately below itself.
  const hero = useMemo(() => {
    if (items.length === 0) return undefined;
    return [...items].sort(
      (a, b) => (b.rating.average ?? -1) - (a.rating.average ?? -1) || b.rating.count - a.rating.count
    )[0];
  }, [items]);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-5 pt-6 pb-4">
        <Text className="text-[34px] font-bold leading-[40px] tracking-[-0.5px] text-foreground">
          {t('store.title')}
        </Text>
        <Text className="mt-0.5 text-[15px] text-muted-foreground">{t('store.subtitle')}</Text>
      </View>

      {isLoading ? (
        <LoadingStorefront />
      ) : isError ? (
        <View className="items-center gap-3 px-5 py-20">
          <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
          <Button variant="secondary" size="small" onPress={() => refetch()}>
            {t('store.retry')}
          </Button>
        </View>
      ) : items.length === 0 ? (
        <View className="items-center gap-2 px-8 py-20">
          <Text className="text-3xl opacity-30">◳</Text>
          <Text className="text-center text-base text-muted-foreground">
            {t('store.emptyStore')}
          </Text>
        </View>
      ) : (
        <>
          {hero ? (
            <View className="px-5 pb-2">
              <HeroCard item={hero} />
            </View>
          ) : null}

          {shelves.map((shelf) => (
            <Shelf key={shelf.category.slug} label={shelf.category.label} apps={shelf.apps} />
          ))}

          <Section title={t('store.allApps')}>
            <View className="flex-col rail:flex-row rail:flex-wrap rail:-mx-2.5">
              {items.map((item, index) => (
                <View key={item.slug} className="w-full rail:w-1/2 rail:px-2.5">
                  <AppListRow item={item} divider={index < items.length - 1} />
                </View>
              ))}
            </View>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="pt-6">
      <Text className="px-5 pb-2 text-[22px] font-bold tracking-[-0.3px] text-foreground">
        {title}
      </Text>
      <View className="px-5">{children}</View>
    </View>
  );
}

/**
 * One shelf: a heading and a horizontal run of tiles.
 *
 * The tiles scroll past the padding rather than inside it, so the last one is
 * cut off by the edge of the screen — which is what tells you there is more.
 */
function Shelf({ label, apps }: { label: string; apps: StoreListingSummary[] }) {
  return (
    <View className="pt-6">
      <Text className="px-5 pb-3 text-[22px] font-bold tracking-[-0.3px] text-foreground">
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
      >
        {apps.map((item) => (
          <ShelfTile key={item.slug} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The storefront's own shape while it loads.
 *
 * Same geometry as the real thing — a hero block and a shelf of tiles — so the
 * page does not reflow when the data lands, which is the only thing a skeleton
 * is for.
 */
function LoadingStorefront() {
  return (
    <>
      <View className="px-5">
        <View className="h-[184px] rounded-3xl bg-card" />
      </View>
      <View className="pt-6">
        <View className="px-5 pb-3">
          <View className="h-5 w-40 rounded-full bg-card" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          scrollEnabled={false}
        >
          {[0, 1, 2, 3].map((tile) => (
            <ShelfTileSkeleton key={tile} />
          ))}
        </ScrollView>
      </View>
    </>
  );
}
