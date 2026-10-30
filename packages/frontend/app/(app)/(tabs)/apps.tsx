import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoryList } from '@/components/category-list';
import { TopLevelPage } from '@/components/page';
import {
  AppShelf,
  SectionTitle,
  StoreEmpty,
  StoreError,
  StorefrontSkeleton,
} from '@/components/store';
import { useTranslation } from '@/lib/i18n';
import { useStorefront } from '@/lib/store';

/**
 * Apps, the catalogue, in the App Store's Apps-tab order: the chart, a shelf
 * per category with its "See All", then the categories themselves — on a phone
 * this page is how Categories is reached.
 *
 * The shelves are grouped in memory from ONE `/store/apps` read rather than a
 * request per category, and a category nobody has published to has no shelf:
 * an empty shelf reads as a store missing things.
 */
export default function AppsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { apps, shelves, topRated, categories, isLoading, isError, refetch } = useStorefront();

  return (
    <TopLevelPage title={t('nav.apps')}>
      {isLoading ? (
        <StorefrontSkeleton shelves={3} />
      ) : isError ? (
        <StoreError onRetry={() => void refetch()} />
      ) : apps.length === 0 ? (
        <StoreEmpty title={t('store.emptyStore')} description={t('store.emptyStoreHelp')} />
      ) : (
        <>
          {topRated.length > 0 ? (
            <AppShelf title={t('discover.topRatedApps')} apps={topRated.slice(0, 15)} ranked />
          ) : null}
          {shelves.map((shelf) => (
            <AppShelf
              key={shelf.category.slug}
              title={shelf.category.label}
              subtitle={shelf.category.description ?? undefined}
              apps={shelf.apps}
              onShowAll={() =>
                router.push({ pathname: '/category/[slug]', params: { slug: shelf.category.slug } })
              }
            />
          ))}
          {categories.length > 0 ? (
            <View className="pt-8">
              <View className="px-5">
                <SectionTitle>{t('nav.categories')}</SectionTitle>
              </View>
              <CategoryList categories={categories} />
            </View>
          ) : null}
        </>
      )}
    </TopLevelPage>
  );
}
