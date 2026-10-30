import { useMemo } from 'react';
import { AskAlia } from '@/components/ask-alia';
import { CategoryList } from '@/components/category-list';
import { TopLevelPage } from '@/components/page';
import {
  AppShelf,
  FeaturedShelf,
  SectionTitle,
  StoreEmpty,
  StoreError,
  StorefrontSkeleton,
} from '@/components/store';
import { View } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useStorefront, type StoreListingSummary } from '@/lib/store';

/** How many editorial cards lead the page. */
const SPOTLIGHT = 5;

/**
 * Discover, the store's front page, in the order the App Store's opens:
 * editorial cards first, then shelves of apps, then the way into the
 * categories.
 *
 * Every section is derived from the catalogue and shown only when it has
 * something behind it. Atlas has no editors, so the cards say what they are —
 * "Top rated" for the best-reviewed apps, "New on Atlas" for the latest — and
 * an empty store says it is empty rather than inventing a front page.
 *
 * Readable signed out: every read is public, so there is no session check here
 * and no blank frame while cold boot resolves.
 */
export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { apps, shelves, topRated, categories, isLoading, isError, refetch } = useStorefront();

  // Best-rated first, then the newest not already shown, so an unreviewed store
  // still has a front page made of what it really has.
  const spotlight = useMemo(() => {
    const cards: { item: StoreListingSummary; eyebrow: string }[] = [];
    const seen = new Set<string>();
    for (const item of topRated.slice(0, 3)) {
      cards.push({ item, eyebrow: t('discover.topRated') });
      seen.add(item.slug);
    }
    for (const item of apps) {
      if (cards.length >= SPOTLIGHT) break;
      if (seen.has(item.slug)) continue;
      cards.push({ item, eyebrow: t('discover.new') });
      seen.add(item.slug);
    }
    return cards;
  }, [apps, topRated, t]);

  // What Alia is told the reader is looking at: the shelves, in the store's order.
  const screenContext =
    shelves.length > 0
      ? t('alia.looking.store', {
          categories: shelves.map((shelf) => shelf.category.label).join(', '),
        })
      : undefined;

  return (
    <TopLevelPage
      title={t('nav.discover')}
      subtitle={t('store.subtitle')}
      titleAccessory={<AskAlia screenContext={screenContext} />}
    >
      {isLoading ? (
        <StorefrontSkeleton />
      ) : isError ? (
        <StoreError onRetry={() => void refetch()} />
      ) : apps.length === 0 ? (
        <StoreEmpty title={t('store.emptyStore')} description={t('store.emptyStoreHelp')} />
      ) : (
        <>
          <FeaturedShelf title={t('discover.spotlight')} cards={spotlight} />
          <AppShelf title={t('discover.newApps')} apps={apps.slice(0, 15)} />
          {topRated.length > 0 ? (
            <AppShelf title={t('discover.topRatedApps')} apps={topRated.slice(0, 15)} ranked />
          ) : null}
          {categories.length > 0 ? (
            <View className="pt-8">
              <View className="px-5">
                <SectionTitle>{t('discover.browseCategories')}</SectionTitle>
              </View>
              <CategoryList categories={categories} />
            </View>
          ) : null}
        </>
      )}
    </TopLevelPage>
  );
}
