import { Text, View } from 'react-native';
import { Button } from '@oxy.so/bloom/button';
import { CategoryList } from '@/components/category-list';
import { TopLevelPage } from '@/components/page';
import { useTranslation } from '@/lib/i18n';
import { useStoreCategories } from '@/lib/store';

/**
 * Every category the store curates, in its order. A sidebar row on a desktop;
 * on a phone it is reached from the Apps page, so it is a route, not a tab.
 */
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const { data: categories, isLoading, isError, refetch } = useStoreCategories();

  return (
    <TopLevelPage title={t('nav.categories')}>
      {isLoading ? null : isError || !categories ? (
        <View className="items-center gap-3 px-5 py-20">
          <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
          <Button appearance="outline" tone="neutral" size="sm" onPress={() => refetch()}>
            {t('store.retry')}
          </Button>
        </View>
      ) : (
        <CategoryList categories={categories} />
      )}
    </TopLevelPage>
  );
}
