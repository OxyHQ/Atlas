import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiSearchLine } from '@oxy.so/bloom/icons/RiSearchLine';
import { Search } from '@oxy.so/bloom/search';
import { CategoryList } from '@/components/category-list';
import { TopLevelPage } from '@/components/page';
import { AppListRow } from '@/components/store-cards';
import { useTranslation } from '@/lib/i18n';
import { useStoreApps, useStoreCategories, type StoreListingSummary } from '@/lib/store';

/**
 * Search.
 *
 * `/search?q=…` is where the sidebar's field lands, so the route's `q` seeds the
 * field. The page is keyed by it: arriving with a new query starts a new search
 * rather than an effect copying the parameter into state.
 */
export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const initial = typeof q === 'string' ? q : '';
  return <SearchPage key={initial} initialQuery={initial} />;
}

/**
 * The store API has no search parameter (`/store/apps` takes a category and a
 * page, nothing else), so this filters the catalogue it already read — by
 * name, tagline and category label — on the device. When the store grows past
 * one page, search belongs in oxy-api and `oxy.store`, not here.
 */
function matches(item: StoreListingSummary, needle: string): boolean {
  return [item.name, item.tagline, item.category?.label].some(
    (field) => typeof field === 'string' && field.toLocaleLowerCase().includes(needle),
  );
}

function SearchPage({ initialQuery }: { initialQuery: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const { data: categories } = useStoreCategories();
  const { data: page, isLoading } = useStoreApps();

  const needle = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () => (needle ? (page?.items ?? []).filter((item) => matches(item, needle)) : []),
    [page, needle],
  );

  return (
    <TopLevelPage title={t('nav.search')}>
      <View className="px-5 pb-4 pt-2">
        <Search
          value={query}
          onChangeText={setQuery}
          onClearText={() => setQuery('')}
          label={t('search.placeholder')}
          returnKeyType="search"
        />
      </View>

      {!needle ? (
        <>
          {categories && categories.length > 0 ? (
            <View className="px-5 pb-6">
              <Text className="pb-1 text-[22px] font-bold tracking-[-0.3px] text-foreground">
                {t('search.discover')}
              </Text>
              {categories.map((category, index) => (
                <Pressable
                  key={category.slug}
                  accessibilityRole="button"
                  onPress={() => setQuery(category.label)}
                  className={
                    index < categories.length - 1
                      ? 'flex-row items-center gap-3 border-b border-border/50 py-3 active:opacity-60'
                      : 'flex-row items-center gap-3 py-3 active:opacity-60'
                  }
                >
                  <Text className="text-[17px] text-primary">{category.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {categories && categories.length > 0 ? (
            <View>
              <Text className="px-5 pb-2 text-[22px] font-bold tracking-[-0.3px] text-foreground">
                {t('nav.categories')}
              </Text>
              <CategoryList categories={categories} />
            </View>
          ) : null}
        </>
      ) : isLoading ? null : results.length === 0 ? (
        <EmptyState
          icon={RiSearchLine}
          title={t('search.noResults')}
          description={t('search.noResultsHelp', { query: query.trim() })}
        />
      ) : (
        <View className="px-5">
          {results.map((item, index) => (
            <AppListRow key={item.slug} item={item} divider={index < results.length - 1} />
          ))}
        </View>
      )}
    </TopLevelPage>
  );
}
