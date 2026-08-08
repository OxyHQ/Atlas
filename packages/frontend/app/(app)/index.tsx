import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { useTranslation } from '@/lib/i18n';
import { formatRating, useStoreApps, useStoreCategories, type StoreListingSummary } from '@/lib/store';

/**
 * The storefront.
 *
 * Readable signed out — every call it makes is a public endpoint — so there is
 * no session check anywhere on this screen and no blank frame while cold boot
 * resolves.
 */
export default function StoreScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [shelf, setShelf] = useState<string | undefined>(undefined);

  const { data: categories } = useStoreCategories();
  const { data: page, isLoading, isError, refetch } = useStoreApps(shelf);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-foreground">{t('store.title')}</Text>
        <Text className="mt-1 text-base text-muted-foreground">{t('store.subtitle')}</Text>
      </View>

      <ShelfPicker
        categories={categories ?? []}
        selected={shelf}
        onSelect={setShelf}
        allLabel={t('store.allApps')}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
      >
        {isLoading ? (
          <ActivityIndicator className="mt-12" />
        ) : isError ? (
          <Pressable onPress={() => refetch()} className="mt-12 items-center">
            <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
            <Text className="mt-1 text-sm text-primary">{t('store.retry')}</Text>
          </Pressable>
        ) : (page?.items.length ?? 0) === 0 ? (
          <Text className="mt-12 text-center text-base text-muted-foreground">
            {shelf ? t('store.emptyShelf') : t('store.emptyStore')}
          </Text>
        ) : (
          <View className="gap-3">
            {page!.items.map((item) => (
              <AppRow key={item.slug} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface ShelfPickerProps {
  categories: Array<{ slug: string; label: string }>;
  selected: string | undefined;
  onSelect: (slug: string | undefined) => void;
  allLabel: string;
}

function ShelfPicker({ categories, selected, onSelect, allLabel }: ShelfPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingVertical: 12 }}
    >
      <Chip label={allLabel} active={selected === undefined} onPress={() => onSelect(undefined)} />
      {categories.map((category) => (
        <Chip
          key={category.slug}
          label={category.label}
          active={selected === category.slug}
          onPress={() => onSelect(category.slug)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={
        active
          ? 'rounded-full bg-primary px-4 py-2'
          : 'rounded-full bg-card px-4 py-2 active:opacity-70'
      }
    >
      <Text
        className={active ? 'text-sm font-semibold text-primary-foreground' : 'text-sm text-foreground'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AppRow({ item }: { item: StoreListingSummary }) {
  const rating = formatRating(item.rating);

  return (
    <Link href={{ pathname: '/app/[slug]', params: { slug: item.slug } }} asChild>
      <Pressable className="flex-row items-center gap-4 rounded-2xl bg-card p-4 active:opacity-80">
        {/* A bare file id plus a variant — the registered ImageResolver turns it
            into a URL. Never a hand-built one. */}
        <Avatar source={item.icon} variant="thumb" size={56} shape="squircle" name={item.name} />

        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          {item.tagline ? (
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {item.tagline}
            </Text>
          ) : null}
          <View className="mt-0.5 flex-row items-center gap-2">
            {item.category ? (
              <Text className="text-xs text-muted-foreground">{item.category.label}</Text>
            ) : null}
            {/* Absent when nobody has reviewed it: an app with no reviews is not
                a zero-star app, so it shows no rating at all. */}
            {rating ? (
              <Text className="text-xs text-muted-foreground">
                ★ {rating} ({item.rating.count})
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
