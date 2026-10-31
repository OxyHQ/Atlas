import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@oxy.so/bloom/button';
import { Card } from '@oxy.so/bloom/card';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiErrorWarningLine } from '@oxy.so/bloom/icons/RiErrorWarningLine';
import { RiStore2Line } from '@oxy.so/bloom/icons/RiStore2Line';
import { Lockup, LockupSkeleton, type LockupSize } from '@oxy.so/bloom/lockup';
import { Shelf, ShelfSkeleton } from '@oxy.so/bloom/media-shelf';
import { Rating } from '@oxy.so/bloom/rating';
import { useTheme } from '@oxy.so/bloom/theme';
import { Text } from '@oxy.so/bloom/typography';
import { InstallAction } from '@/components/install-action';
import { useTranslation } from '@/lib/i18n';
import { formatCount, type StoreListingSummary } from '@/lib/store';

/**
 * The store's pieces, in the App Store's grammar, every one of them a Bloom
 * component given Atlas's data: a lockup for an app, a paged shelf of them, an
 * editorial card, and the states a page can be in. Nothing here draws its own
 * icon, row or shelf — Bloom owns those, and a fix there reaches every Oxy app.
 */

/** The page gutter every section lines up on; shelves bleed past it to the panel's edges. */
export const GUTTER = 20;

/** The slice of the next column a shelf leaves in view, so a touch reader sees there is more. */
const PEEK = 24;

/** Where an app's page is. One place, so a slug is never turned into a link two ways. */
export function useOpenApp(): (slug: string) => void {
  const router = useRouter();
  return (slug) => router.push({ pathname: '/app/[slug]', params: { slug } });
}

/**
 * The lockup's action where nothing installs applications.
 *
 * There Atlas installs nothing, so there is no "Get": the pill opens the app's
 * page, which is where "Open" (its website) lives. Its name says which app,
 * because a column of buttons all called "View" is a list of identical controls
 * to a screen reader. Where the machine installs applications, the lockup's
 * action is `InstallAction` instead, with this as what it falls back to.
 */
function ViewButton({ item }: { item: StoreListingSummary }) {
  const { t } = useTranslation();
  const open = useOpenApp();
  return (
    <Button
      size="sm"
      appearance="subtle"
      tone="accent"
      accessibilityLabel={t('store.viewApp', { name: item.name })}
      onPress={() => open(item.slug)}
    >
      {t('store.view')}
    </Button>
  );
}

/**
 * One app as the store lists it: Bloom's `Lockup` with the app's icon (a file id
 * the registered `ImageResolver` turns into a URL), its tagline, and its rating
 * only when it has one — an unreviewed app shows no stars, not zero.
 */
export function AppLockup({
  item,
  size = 'md',
  rank,
  divider,
}: {
  item: StoreListingSummary;
  size?: LockupSize;
  rank?: number;
  divider?: boolean;
}) {
  const { locale } = useTranslation();
  const open = useOpenApp();
  return (
    <Lockup
      size={size}
      title={item.name}
      subtitle={item.tagline ?? item.category?.label}
      icon={item.icon}
      rank={rank}
      divider={divider}
      caption={
        item.rating.average !== null ? (
          <Rating
            value={item.rating.average}
            count={formatCount(item.rating.count, locale)}
            size="sm"
          />
        ) : undefined
      }
      href={`/app/${item.slug}`}
      onPress={() => open(item.slug)}
      action={
        <InstallAction
          slug={item.slug}
          name={item.name}
          size="sm"
          fallback={<ViewButton item={item} />}
        />
      }
      testID={`lockup-${item.slug}`}
    />
  );
}

/** A heading for a section that is not a shelf, in the shelf's own type step. */
export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-end justify-between gap-4 pb-3">
      <Text
        variant="title-2-bold"
        role="heading"
        aria-level={2}
        style={{ color: colors.text, flexShrink: 1 }}
      >
        {children}
      </Text>
      {action}
    </View>
  );
}

/**
 * A shelf of apps: Bloom's paged `Shelf`, up to three lockups to a column, whole
 * columns to a page and the next one peeking. The lockups separate the rows of
 * each column themselves.
 */
export function AppShelf({
  title,
  subtitle,
  apps,
  rows = 3,
  ranked = false,
  onShowAll,
}: {
  title: string;
  subtitle?: string;
  apps: readonly StoreListingSummary[];
  rows?: number;
  ranked?: boolean;
  onShowAll?: () => void;
}) {
  return (
    <View className="px-5 pt-8">
      <Shelf
        title={title}
        subtitle={subtitle}
        layout="paged"
        rows={Math.max(1, Math.min(rows, apps.length))}
        minItemWidth={300}
        peek={PEEK}
        gap={GUTTER}
        rowGap={0}
        contentInset={GUTTER}
        onShowAll={onShowAll}
      >
        {apps.map((item, index) => (
          <AppLockup key={item.slug} item={item} rank={ranked ? index + 1 : undefined} />
        ))}
      </Shelf>
    </View>
  );
}

/** Every app of a list, as a grid of lockups that wraps instead of scrolling. */
export function AppGrid({ title, apps }: { title: string; apps: readonly StoreListingSummary[] }) {
  return (
    <View className="px-5 pt-6">
      <Shelf title={title} layout="grid" rows={Infinity} minItemWidth={340} gap={GUTTER} rowGap={0}>
        {apps.map((item) => (
          <AppLockup key={item.slug} item={item} />
        ))}
      </Shelf>
    </View>
  );
}

/**
 * An editorial card: what the App Store's front page leads with. A short label,
 * the app's own line about itself as the headline, and the app underneath.
 *
 * The whole card is ONE link; the lockup inside it is therefore drawn without
 * its own press target or action, which would otherwise be a control inside a
 * control.
 */
export function FeaturedCard({ item, eyebrow }: { item: StoreListingSummary; eyebrow: string }) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const open = useOpenApp();
  return (
    <Card
      appearance="subtle"
      tone="accent"
      radius="radius-20"
      onPress={() => open(item.slug)}
      accessibilityRole="link"
      accessibilityLabel={t('store.featuredLabel', { eyebrow, name: item.name })}
      testID={`featured-${item.slug}`}
    >
      {/* A fixed height, so the cards of one shelf line up and the app sits at
          the foot of each whatever its headline's length. */}
      <View style={{ minHeight: 228, padding: GUTTER, justifyContent: 'space-between', gap: 16 }}>
        <View className="gap-1">
          <Text variant="caption-1-semibold" style={{ color: colors.primary }}>
            {eyebrow.toLocaleUpperCase()}
          </Text>
          <Text variant="title-1-bold" numberOfLines={3} style={{ color: colors.text }}>
            {item.tagline ?? item.name}
          </Text>
        </View>
        <Lockup
          size="sm"
          title={item.name}
          subtitle={item.category?.label}
          icon={item.icon}
          caption={
            item.rating.average !== null ? (
              <Rating
                value={item.rating.average}
                count={formatCount(item.rating.count, locale)}
                size="sm"
              />
            ) : undefined
          }
        />
      </View>
    </Card>
  );
}

/** The editorial cards, as a paged shelf of one row. */
export function FeaturedShelf({
  title,
  cards,
}: {
  title: string;
  cards: readonly { item: StoreListingSummary; eyebrow: string }[];
}) {
  return (
    <View className="px-5 pt-2">
      <Shelf
        title={title}
        layout="paged"
        minItemWidth={340}
        peek={PEEK}
        gap={GUTTER}
        contentInset={GUTTER}
      >
        {cards.map(({ item, eyebrow }) => (
          <FeaturedCard key={item.slug} item={item} eyebrow={eyebrow} />
        ))}
      </Shelf>
    </View>
  );
}

/** A storefront still loading: shelves of lockup placeholders at the real geometry. */
export function StorefrontSkeleton({ shelves = 2 }: { shelves?: number }) {
  return (
    <View className="gap-8 px-5 pt-8">
      {Array.from({ length: shelves }, (_, shelf) => (
        <View key={`shelf-${shelf.toString()}`} className="gap-3">
          <ShelfSkeleton count={0} />
          <View>
            <LockupSkeleton divider />
            <LockupSkeleton divider />
            <LockupSkeleton />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The catalogue could not be read. */
export function StoreError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="px-5 py-16">
      <EmptyState
        icon={RiErrorWarningLine}
        title={t('store.loadFailed')}
        action={{ label: t('store.retry'), onPress: onRetry }}
      />
    </View>
  );
}

/** Nothing published yet: said plainly, with nothing invented to fill the page. */
export function StoreEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <View className="px-5 py-16">
      <EmptyState icon={RiStore2Line} title={title} description={description} />
    </View>
  );
}
