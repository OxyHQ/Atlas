import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { Button } from '@oxyhq/bloom/button';
import { useTranslation } from '@/lib/i18n';
import { formatRating, useStoreApps, useStoreCategories, type StoreListingSummary } from '@/lib/store';

/**
 * The storefront.
 *
 * Readable signed out — every call it makes is a public endpoint — so there is
 * no session check anywhere on this screen and no blank frame while cold boot
 * resolves.
 *
 * The panel it renders into is already width-capped by the shell, so nothing
 * here fights for the whole window: rows go two-up once there is room, and the
 * shelf strip sticks to the top while the list scrolls under it.
 *
 * The two-up is `rail:w-1/2` on each row's wrapper — a media query, not a width
 * read, so resizing the window is the browser reflowing rather than React
 * re-rendering the list on every frame.
 */
export default function StoreScreen() {
  const { t } = useTranslation();
  const [shelf, setShelf] = useState<string | undefined>(undefined);

  const { data: categories } = useStoreCategories();
  const { data: page, isLoading, isError, refetch } = useStoreApps(shelf);

  const items = page?.items ?? [];

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-5 pb-1">
        <Text className="text-[32px] font-bold leading-tight text-foreground">
          {t('store.title')}
        </Text>
        <Text className="mt-1 text-base text-muted-foreground">{t('store.subtitle')}</Text>
      </View>

      <ShelfStrip
        categories={categories ?? []}
        selected={shelf}
        onSelect={setShelf}
        allLabel={t('store.allApps')}
      />

      <View className="px-5">
        {isLoading ? (
          <View className="gap-2">
            {[0, 1, 2, 3].map((row) => (
              <RowSkeleton key={row} />
            ))}
          </View>
        ) : isError ? (
          <View className="items-center gap-3 py-16">
            <Text className="text-base text-muted-foreground">{t('store.loadFailed')}</Text>
            <Button variant="secondary" size="small" onPress={() => refetch()}>
              {t('store.retry')}
            </Button>
          </View>
        ) : items.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Text className="text-2xl opacity-40">◳</Text>
            <Text className="text-center text-base text-muted-foreground">
              {shelf ? t('store.emptyShelf') : t('store.emptyStore')}
            </Text>
          </View>
        ) : (
          // Two-up once there is room. One wrapping row with a half-width
          // basis, rather than a grid and a breakpoint table to keep in sync:
          // below `rail:` the basis is full width and it degrades to a column
          // on its own.
          <View className="flex-col rail:flex-row rail:flex-wrap rail:-mx-1.5">
            {items.map((item) => (
              <View key={item.slug} className="w-full rail:w-1/2 rail:px-1.5 rail:pb-2">
                <AppRow item={item} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

interface ShelfStripProps {
  categories: Array<{ slug: string; label: string }>;
  selected: string | undefined;
  onSelect: (slug: string | undefined) => void;
  allLabel: string;
}

/**
 * The shelves, as a sticky strip.
 *
 * Sticky on web only, and only because the shell renders the route through
 * `<Slot/>` so the document is the scroller — inside a viewport-clamped scene
 * this would do nothing at all.
 */
function ShelfStrip({ categories, selected, onSelect, allLabel }: ShelfStripProps) {
  return (
    <View
      className="border-b border-border/60 bg-background"
      style={Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 10 } as never) : null}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 10 }}
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
    </View>
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
          ? 'rounded-full bg-foreground px-3.5 py-1.5'
          : 'rounded-full border border-border px-3.5 py-1.5 active:opacity-70'
      }
    >
      <Text
        className={
          active ? 'text-sm font-semibold text-background' : 'text-sm font-medium text-foreground'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AppRow({ item }: { item: StoreListingSummary }) {
  const router = useRouter();
  const rating = formatRating(item.rating);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.name}
      onPress={() => router.push(`/app/${item.slug}`)}
      className="flex-row items-center gap-3.5 rounded-2xl px-2 py-2.5 active:opacity-70"
    >
      {/* A bare file id plus a variant — the registered ImageResolver turns it
          into a URL. Never a hand-built one. */}
      <Avatar source={item.icon} variant="thumb" size={60} shape="squircle" name={item.name} />

      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        {item.tagline ? (
          <Text className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground" numberOfLines={2}>
            {item.tagline}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center gap-1.5">
          {/* Absent when nobody has reviewed it: an app with no reviews is not a
              zero-star app, so it shows no rating at all. */}
          {rating ? (
            <Text className="text-xs text-muted-foreground">
              ★ {rating} · {item.rating.count}
            </Text>
          ) : null}
          {rating && item.category ? <Text className="text-xs text-muted-foreground">·</Text> : null}
          {item.category ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {item.category.label}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * A row-shaped placeholder.
 *
 * The same geometry as a real row, so the list does not jump when the data
 * lands — which is the only thing a skeleton is for.
 */
function RowSkeleton() {
  return (
    <View className="flex-row items-center gap-3.5 px-2 py-2.5">
      <View className="h-[60px] w-[60px] rounded-2xl bg-card" />
      <View className="flex-1 gap-2">
        <View className="h-3.5 w-1/3 rounded-full bg-card" />
        <View className="h-3 w-2/3 rounded-full bg-card" />
        <View className="h-3 w-1/4 rounded-full bg-card" />
      </View>
    </View>
  );
}
