import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@oxy.so/bloom/button';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { categoryIcon } from '@/components/navigation';
import { TopLevelPage } from '@/components/page';
import { AppListRow } from '@/components/store-cards';
import { useTranslation } from '@/lib/i18n';
import { useStoreApps, useStoreCategories } from '@/lib/store';

/**
 * One category: its label as the large title, the store's description under it,
 * then its apps as rows.
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
      {isLoading || categoriesLoading ? null : isError ? (
        <View className="items-center gap-3 px-5 py-20">
          <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
          <Button appearance="outline" tone="neutral" size="sm" onPress={() => refetch()}>
            {t('store.retry')}
          </Button>
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={categoryIcon(slug)}
          title={t('category.empty')}
          description={t('category.emptyHelp')}
        />
      ) : (
        <View className="px-5 pt-2">
          {items.map((item, index) => (
            <AppListRow key={item.slug} item={item} divider={index < items.length - 1} />
          ))}
        </View>
      )}
    </TopLevelPage>
  );
}
