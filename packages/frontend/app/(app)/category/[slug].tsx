import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { categoryIcon } from '@/components/navigation';
import { TopLevelPage } from '@/components/page';
import { AppGrid, StoreError, StorefrontSkeleton } from '@/components/store';
import { useTranslation } from '@/lib/i18n';
import { useStoreApps, useStoreCategories } from '@/lib/store';

/**
 * One category — the page a shelf's "See All" opens: its label as the large
 * title, the store's description under it, then every app in it as a grid of
 * lockups.
 *
 * The label and description come from the categories read, never from the slug:
 * an unknown slug is a category the store does not have, and says so, rather
 * than a page titled with whatever was typed into the address bar.
 */
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { data: categories, isLoading: categoriesLoading } = useStoreCategories();
  const { data: page, isLoading, isError, refetch } = useStoreApps(slug);

  const category = useMemo(
    () => categories?.find((candidate) => candidate.slug === slug),
    [categories, slug],
  );
  const items = page?.items ?? [];

  if (!categoriesLoading && categories && !category) {
    return (
      <TopLevelPage title={t('nav.categories')}>
        <EmptyState title={t('category.notFound')} />
      </TopLevelPage>
    );
  }

  return (
    <TopLevelPage title={category?.label ?? ''} subtitle={category?.description ?? undefined}>
      {isLoading || categoriesLoading ? (
        <StorefrontSkeleton shelves={1} />
      ) : isError ? (
        <StoreError onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={categoryIcon(slug)}
          title={t('category.empty')}
          description={t('category.emptyHelp')}
        />
      ) : (
        <AppGrid title={t('category.appCount', { count: items.length })} apps={items} />
      )}
    </TopLevelPage>
  );
}
