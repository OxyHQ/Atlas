import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { Button } from '@oxyhq/bloom/button';
import { useTranslation } from '@/lib/i18n';
import { formatRating, type StoreListingSummary } from '@/lib/store';

/**
 * The three shapes an app takes on the storefront, in the App Store's grammar:
 * a hero, a tile in a shelf, and a row in a list.
 *
 * All three are NativeWind for layout and Bloom for the pieces that have to
 * match every other Oxy app — `Avatar` for the icon, `Button` for the action.
 * Nothing here re-implements a Bloom component with classes.
 */

/** Where a card sends you. One place, so a slug never gets built two ways. */
function useOpenApp(slug: string): () => void {
  const router = useRouter();
  return () => router.push(`/app/${slug}`);
}

/**
 * The row's trailing action.
 *
 * The App Store's GET sits at the trailing edge and is the only pressable thing
 * on the row that is not the row. Here it opens the page rather than installing,
 * because Atlas lists apps it does not distribute — an "Install" that navigated
 * to a website would be a lie about what the button does.
 */
function OpenButton({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const open = useOpenApp(slug);
  return (
    <Button variant="secondary" size="small" onPress={open}>
      {t('store.view')}
    </Button>
  );
}

/**
 * The hero.
 *
 * One app, given the room the App Store gives its Today cards, so the store
 * opens with something to look at rather than a list that starts at the top.
 */
export function HeroCard({ item }: { item: StoreListingSummary }) {
  const { t } = useTranslation();
  const open = useOpenApp(item.slug);
  const rating = formatRating(item.rating);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.name}
      onPress={open}
      className="overflow-hidden rounded-3xl bg-card active:opacity-90"
    >
      <View className="gap-4 p-5">
        <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
          {item.category?.label ?? t('store.featured')}
        </Text>

        <View className="flex-row items-center gap-4">
          <Avatar source={item.icon} variant="full" size={72} shape="squircle" name={item.name} />
          <View className="min-w-0 flex-1">
            <Text className="text-[22px] font-bold leading-7 text-foreground" numberOfLines={1}>
              {item.name}
            </Text>
            {item.tagline ? (
              <Text className="mt-1 text-[15px] leading-5 text-muted-foreground" numberOfLines={2}>
                {item.tagline}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          {rating ? (
            <Text className="text-[13px] text-muted-foreground">
              ★ {rating} · {t('app.reviewCount', { count: item.rating.count })}
            </Text>
          ) : (
            <Text className="text-[13px] text-muted-foreground">{t('app.noReviewsYet')}</Text>
          )}
          <Button variant="primary" size="small" onPress={open}>
            {t('store.view')}
          </Button>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * A tile in a horizontal shelf.
 *
 * Fixed width on purpose: a shelf that sizes its tiles to their content gives
 * every row a different rhythm, and the App Store's shelves read as shelves
 * because the tiles line up.
 */
export function ShelfTile({ item }: { item: StoreListingSummary }) {
  const open = useOpenApp(item.slug);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.name}
      onPress={open}
      className="w-[112px] gap-2 active:opacity-70"
    >
      <Avatar source={item.icon} variant="thumb" size={112} shape="squircle" name={item.name} />
      <View>
        <Text className="text-[13px] font-medium leading-4 text-foreground" numberOfLines={2}>
          {item.name}
        </Text>
        {item.tagline ? (
          <Text className="text-[12px] leading-4 text-muted-foreground" numberOfLines={1}>
            {item.tagline}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A row in a list: icon, two lines, and the action at the trailing edge. */
export function AppListRow({ item, divider }: { item: StoreListingSummary; divider: boolean }) {
  const open = useOpenApp(item.slug);
  const rating = formatRating(item.rating);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.name}
      onPress={open}
      className="flex-row items-center gap-3.5 py-2.5 active:opacity-70"
    >
      <Avatar source={item.icon} variant="thumb" size={56} shape="squircle" name={item.name} />

      <View
        className={
          divider
            ? 'min-w-0 flex-1 flex-row items-center gap-3 border-b border-border/50 pb-2.5'
            : 'min-w-0 flex-1 flex-row items-center gap-3'
        }
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          {item.tagline ? (
            <Text className="text-[13px] leading-[17px] text-muted-foreground" numberOfLines={1}>
              {item.tagline}
            </Text>
          ) : null}
          {rating ? (
            <Text className="mt-0.5 text-[12px] text-muted-foreground">
              ★ {rating} · {item.rating.count}
            </Text>
          ) : null}
        </View>

        <OpenButton slug={item.slug} />
      </View>
    </Pressable>
  );
}

/** A tile-shaped placeholder, so a shelf does not resize when its data lands. */
export function ShelfTileSkeleton() {
  return (
    <View className="w-[112px] gap-2">
      <View className="h-[112px] w-[112px] rounded-[26px] bg-card" />
      <View className="gap-1.5">
        <View className="h-3 w-4/5 rounded-full bg-card" />
        <View className="h-2.5 w-3/5 rounded-full bg-card" />
      </View>
    </View>
  );
}
