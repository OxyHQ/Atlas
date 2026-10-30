import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '@oxy.so/bloom/button';
import { AskAlia } from '@/components/ask-alia';
import { TopLevelPage } from '@/components/page';
import { AppListRow, HeroCard, ShelfTileSkeleton } from '@/components/store-cards';
import { useTranslation } from '@/lib/i18n';
import { useStoreApps, useStoreCategories } from '@/lib/store';

/**
 * Discover, the store's front page: a hero, then everything as a list. The
 * per-category shelves are the Apps page's.
 *
 * Readable signed out — every call it makes is a public endpoint — so there is
 * no session check anywhere on this screen and no blank frame while cold boot
 * resolves.

 */
export default function StoreScreen() {
  const { t } = useTranslation();
  const { data: categories } = useStoreCategories();
  const { data: page, isLoading, isError, refetch } = useStoreApps();

  const items = useMemo(() => page?.items ?? [], [page]);

  // What Alia is told the reader is looking at: the shelves that have something
  // on them, in the store's order.
  const shelfLabels = useMemo(() => {
    const present = new Set(items.flatMap((item) => (item.category ? [item.category.slug] : [])));
    return (categories ?? []).filter((c) => present.has(c.slug)).map((c) => c.label);
  }, [items, categories]);

  const screenContext = useMemo(
    () =>
      shelfLabels.length > 0
        ? t('alia.looking.store', { categories: shelfLabels.join(', ') })
        : undefined,
    [shelfLabels, t],
  );

  // The hero is the best-reviewed app, falling back to the newest. Whatever it
  // is, it must not appear again immediately below itself.
  const hero = useMemo(() => {
    if (items.length === 0) return undefined;
    return [...items].sort(
      (a, b) =>
        (b.rating.average ?? -1) - (a.rating.average ?? -1) || b.rating.count - a.rating.count,
    )[0];
  }, [items]);

  return (
    <TopLevelPage
      title={t('nav.discover')}
      subtitle={t('store.subtitle')}
      titleAccessory={<AskAlia screenContext={screenContext} />}
    >
      {isLoading ? (
        <LoadingStorefront />
      ) : isError ? (
        <View className="items-center gap-3 px-5 py-20">
          <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
          <Button appearance="outline" tone="neutral" size="sm" onPress={() => refetch()}>
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

          <Section title={t('store.allApps')}>
            <View>
              {items.map((item, index) => (
                <AppListRow key={item.slug} item={item} divider={index < items.length - 1} />
              ))}
            </View>
          </Section>
        </>
      )}
    </TopLevelPage>
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
