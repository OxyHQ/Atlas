import { useMemo, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@oxy.so/bloom/button';
import { Card } from '@oxy.so/bloom/card';
import { Divider } from '@oxy.so/bloom/divider';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { ExpandableText } from '@oxy.so/bloom/expandable-text';
import { FactStrip, type FactStripItem } from '@oxy.so/bloom/fact-strip';
import { GroupedSection, GroupedSectionItem } from '@oxy.so/bloom/grouped-section';
import { RiGlobalLine } from '@oxy.so/bloom/icons/RiGlobalLine';
import { RiStore2Line } from '@oxy.so/bloom/icons/RiStore2Line';
import { ReviewCard } from '@oxy.so/bloom/listing-details';
import { Lockup, LockupSkeleton } from '@oxy.so/bloom/lockup';
import { Shelf } from '@oxy.so/bloom/media-shelf';
import { Rating, RatingSummary } from '@oxy.so/bloom/rating';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItemText,
} from '@oxy.so/bloom/segmented-control';
import * as Skeleton from '@oxy.so/bloom/skeleton';
import { useTheme } from '@oxy.so/bloom/theme';
import { Text } from '@oxy.so/bloom/typography';
import { useOxy } from '@oxy.so/services/ui/client';
import { InstallAction } from '@/components/install-action';
import { CategoryGlyph } from '@/components/navigation';
import { WriteReview } from '@/components/write-review';
import { DetailPage } from '@/components/page';
import { AppShelf, GUTTER, SectionTitle } from '@/components/store';
import { useStoreInstaller } from '@/lib/installer';
import { useTranslation } from '@/lib/i18n';
import {
  formatCount,
  formatRating,
  useStoreApp,
  useStoreApps,
  useStoreReviews,
  type StoreListingDetail,
  type StoreReview,
} from '@/lib/store';

type Platform = StoreListingDetail['screenshots'][number]['platform'];

/** The order the store's frames are offered in, and each frame's shape. */
const PLATFORMS: readonly Platform[] = ['phone', 'tablet', 'desktop', 'web'];
const FRAME: Record<Platform, { width: number; aspectRatio: number }> = {
  phone: { width: 232, aspectRatio: 9 / 19.5 },
  tablet: { width: 330, aspectRatio: 3 / 4 },
  desktop: { width: 520, aspectRatio: 16 / 10 },
  web: { width: 520, aspectRatio: 16 / 10 },
};

/**
 * An app's page, in the App Store's order: the header (icon, name, line, the
 * action), the facts strip, the screenshots, the description, Ratings & Reviews,
 * Information, and more of the same kind.
 *
 * Every section rests on data the listing really has and is absent otherwise:
 * no developer row (a listing names none), no size, age rating, version history
 * or "What's New" (the store records none of them), and no rating at all for an
 * app nobody has reviewed.
 */
export default function AppPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: app, isLoading, isError } = useStoreApp(slug);

  if (isLoading) {
    return (
      <DetailPage>
        <AppPageSkeleton />
      </DetailPage>
    );
  }

  if (isError || !app) {
    return (
      <DetailPage>
        <View className="px-5 py-16">
          <EmptyState
            icon={RiStore2Line}
            title={t('app.notFound')}
            action={{ label: t('app.backToStore'), onPress: () => router.replace('/') }}
          />
        </View>
      </DetailPage>
    );
  }

  return (
    <DetailPage title={app.name}>
      <View className="px-5 pt-2">
        <Lockup
          size="lg"
          title={app.name}
          subtitle={app.tagline}
          icon={app.icon}
          caption={app.category?.label}
          action={
            <InstallAction
              slug={app.slug}
              name={app.name}
              fallback={
                app.websiteUrl ? (
                  <Button
                    appearance="solid"
                    tone="accent"
                    accessibilityLabel={t('app.openApp', { name: app.name })}
                    onPress={() => {
                      if (app.websiteUrl) void Linking.openURL(app.websiteUrl);
                    }}
                  >
                    {t('app.open')}
                  </Button>
                ) : undefined
              }
            />
          }
          testID="app-header"
        />
      </View>

      <View className="px-5 pt-5">
        <Facts app={app} />
      </View>

      {app.screenshots.length > 0 ? <Screenshots screenshots={app.screenshots} /> : null}

      {app.description ? (
        <View className="px-5 pt-6">
          <ExpandableText toggle="inline" numberOfLines={4} testID="app-description">
            {app.description}
          </ExpandableText>
        </View>
      ) : null}

      <SectionDivider />
      <RatingsAndReviews app={app} />

      <SectionDivider />
      <Information app={app} />

      {app.category ? <MoreLikeThis slug={app.slug} category={app.category.slug} /> : null}
    </DetailPage>
  );
}

function SectionDivider() {
  return (
    <View className="px-5 pt-8">
      <Divider />
    </View>
  );
}

/** The month and year a listing was published, in the reader's language. */
function formatMonthYear(iso: string, locale: string): { year: string; month: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(date),
    month: new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
  };
}

/** A website's host, the part a reader recognises. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * The facts under the header: the rating, the category, when it was published
 * and where it lives on the web — each only when the listing has it.
 */
function Facts({ app }: { app: StoreListingDetail }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const rating = formatRating(app.rating);
  const released = app.publishedAt ? formatMonthYear(app.publishedAt, locale) : null;
  const category = app.category;
  const website = app.websiteUrl;

  const items = useMemo(() => {
    const facts: FactStripItem[] = [
      rating && app.rating.average !== null
        ? {
            key: 'ratings',
            label: t('app.reviewCount', {
              count: formatCount(app.rating.count, locale),
              plural: app.rating.count,
            }),
            value: rating,
            caption: (
              <Rating
                value={app.rating.average}
                variant="stars"
                showValue={false}
                starSize={11}
                size="sm"
              />
            ),
            accessibilityLabel: t('app.ratedFact', {
              rating,
              count: formatCount(app.rating.count, locale),
              plural: app.rating.count,
            }),
          }
        : {
            key: 'ratings',
            label: t('app.ratings'),
            value: '—',
            caption: t('app.noReviewsYet'),
            accessibilityLabel: t('app.noReviewsYet'),
          },
    ];
    if (category) {
      facts.push({
        key: 'category',
        label: t('app.category'),
        value: <CategoryGlyph slug={category.slug} size={24} color={colors.textSecondary} />,
        caption: category.label,
        accessibilityLabel: t('app.categoryFact', { category: category.label }),
        onPress: () =>
          router.push({ pathname: '/category/[slug]', params: { slug: category.slug } }),
      });
    }
    if (released) {
      facts.push({
        key: 'released',
        label: t('app.released'),
        value: released.year,
        caption: released.month,
      });
    }
    if (website) {
      facts.push({
        key: 'website',
        label: t('app.website'),
        value: <RiGlobalLine width={24} height={24} fill={colors.textSecondary} />,
        caption: hostOf(website),
        accessibilityLabel: t('app.websiteFact', { host: hostOf(website) }),
        onPress: () => void Linking.openURL(website),
      });
    }
    return facts;
  }, [app.rating, rating, category, released, website, colors.textSecondary, router, t, locale]);

  return <FactStrip items={items} contentInset={GUTTER} accessibilityLabel={t('app.facts')} />;
}

/**
 * The screenshots, a frame at a time: the App Store's "Preview". When the
 * listing has pictures from more than one kind of device, a segmented control
 * picks which, as the store does with its device row.
 *
 * Each picture is the listing's file id turned into a URL by the SDK's one
 * chokepoint (`assets.publicUrl`); a screenshot is not an avatar, so it does not
 * go through `Avatar`.
 */
function Screenshots({ screenshots }: { screenshots: StoreListingDetail['screenshots'] }) {
  const { t } = useTranslation();
  const { oxyServices } = useOxy();
  const { colors } = useTheme();
  const platforms = PLATFORMS.filter((platform) =>
    screenshots.some((shot) => shot.platform === platform),
  );
  const [chosen, setChosen] = useState<Platform | null>(null);
  const platform = chosen && platforms.includes(chosen) ? chosen : (platforms[0] ?? 'phone');
  const frame = FRAME[platform];
  const shots = screenshots
    .filter((shot) => shot.platform === platform)
    .sort((a, b) => a.position - b.position);

  return (
    <View className="gap-3 px-5 pt-8">
      <Shelf title={t('app.preview')} itemWidth={frame.width} gap={12} contentInset={GUTTER}>
        {shots.map((shot, index) => (
          <Image
            key={shot.id}
            source={{ uri: oxyServices.assets.publicUrl(shot.fileId, 'full') }}
            accessibilityLabel={
              shot.caption ?? t('app.screenshotLabel', { index: index + 1, count: shots.length })
            }
            resizeMode="cover"
            style={{
              width: frame.width,
              aspectRatio: frame.aspectRatio,
              borderRadius: platform === 'phone' ? 24 : 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            }}
          />
        ))}
      </Shelf>
      {platforms.length > 1 ? (
        <View className="flex-row">
          <SegmentedControl
            label={t('app.screenshotsFor')}
            type="radio"
            value={platform}
            onValueChange={(value) => setChosen(value)}
          >
            {platforms.map((option) => (
              <SegmentedControlItem key={option} value={option}>
                <SegmentedControlItemText>{t(`platform.${option}`)}</SegmentedControlItemText>
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Ratings & Reviews: the summary, the reviews as cards, and the reader's own.
 *
 * The summary and its bars are the API's numbers, computed from the visible
 * reviews on every read; an app nobody has reviewed shows "No ratings yet" and
 * no bars, never a zero.
 */
function RatingsAndReviews({ app }: { app: StoreListingDetail }) {
  const { t } = useTranslation();
  const { data: reviews } = useStoreReviews(app.slug);
  const items = reviews?.items ?? [];

  return (
    <View className="pt-8">
      <View className="px-5">
        <SectionTitle>{t('app.ratingsAndReviews')}</SectionTitle>
        <RatingSummary
          average={app.rating.average}
          count={app.rating.count}
          distribution={app.ratingBreakdown}
          // The distribution is read at a glance; across a wide panel its bars
          // would stretch into lines nobody compares.
          style={{ maxWidth: 520 }}
          testID="app-ratings"
        />
      </View>

      {items.length > 0 ? (
        <View className="px-5 pt-6">
          <Shelf
            title={t('app.reviews')}
            layout="paged"
            minItemWidth={320}
            peek={24}
            gap={GUTTER}
            contentInset={GUTTER}
          >
            {items.map((review) => (
              <ReviewTile key={review.id} review={review} />
            ))}
          </Shelf>
        </View>
      ) : null}

      <View className="px-5 pt-6">
        <ReviewAction slug={app.slug} />
      </View>
    </View>
  );
}

/**
 * Rating the app. Where the machine installs applications (OxyOS), an application's account is
 * to come from the machine itself (OxyOS ADR 0020, decision 6), which it cannot give yet; until
 * it can, Atlas there says reviews are not available yet and signs in to nothing. Reading them
 * needs no account, and stays.
 */
function ReviewAction({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const installer = useStoreInstaller();
  if (installer) {
    return (
      <Text
        variant="body-regular"
        style={{ color: colors.textSecondary }}
        testID="reviews-not-available"
      >
        {t('app.reviewsNotAvailable')}
      </Text>
    );
  }
  return <WriteReview slug={slug} />;
}

/** One review, as Bloom's `ReviewCard` on a card of its own. */
function ReviewTile({ review }: { review: StoreReview }) {
  const { t, locale } = useTranslation();
  const author = review.author.username ?? t('app.someone');
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(review.createdAt),
  );
  return (
    <Card radius="radius-20" style={{ flex: 1 }}>
      <View style={{ padding: GUTTER }}>
        <ReviewCard
          name={author}
          // Only ever said when true. It is false for a first-party app nobody
          // consents to, so its absence must not read as a demotion.
          subtitle={review.authorUsesApp ? t('app.usesThisApp') : undefined}
          rating={review.rating}
          date={date}
          heading={review.title ?? undefined}
          text={review.body ?? ''}
          numberOfLines={5}
          hostResponse={
            review.reply
              ? {
                  title: t('app.developerReply'),
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(review.reply.createdAt),
                  ),
                  text: review.reply.body,
                }
              : undefined
          }
        />
      </View>
    </Card>
  );
}

/**
 * Information: the App Store's table of plain facts, from what the listing has —
 * its category, when it was published, and the application's own links.
 */
function Information({ app }: { app: StoreListingDetail }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const published = app.publishedAt ? new Date(app.publishedAt) : null;
  const links: { key: string; title: string; url: string }[] = [
    app.websiteUrl ? { key: 'website', title: t('app.website'), url: app.websiteUrl } : null,
    app.supportUrl ? { key: 'support', title: t('app.support'), url: app.supportUrl } : null,
    app.supportEmail
      ? { key: 'email', title: t('app.supportEmail'), url: `mailto:${app.supportEmail}` }
      : null,
    app.privacyPolicyUrl
      ? { key: 'privacy', title: t('app.privacy'), url: app.privacyPolicyUrl }
      : null,
    app.termsUrl ? { key: 'terms', title: t('app.terms'), url: app.termsUrl } : null,
  ].filter((link): link is { key: string; title: string; url: string } => link !== null);
  const category = app.category;

  return (
    <View className="gap-4 px-5 pt-8">
      <SectionTitle>{t('app.information')}</SectionTitle>
      <GroupedSection>
        {category ? (
          <GroupedSectionItem
            title={t('app.category')}
            value={category.label}
            onPress={() =>
              router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })
            }
          />
        ) : null}
        {published && !Number.isNaN(published.getTime()) ? (
          <GroupedSectionItem
            title={t('app.released')}
            value={new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(published)}
          />
        ) : null}
        {links.map((link) => (
          <GroupedSectionItem
            key={link.key}
            title={link.title}
            onPress={() => void Linking.openURL(link.url)}
          />
        ))}
      </GroupedSection>
    </View>
  );
}

/** "You Might Also Like": the rest of the app's category. */
function MoreLikeThis({ slug, category }: { slug: string; category: string }) {
  const { t } = useTranslation();
  const { data } = useStoreApps(category);
  const others = (data?.items ?? []).filter((item) => item.slug !== slug);
  if (others.length === 0) return null;
  return <AppShelf title={t('app.mightAlsoLike')} apps={others} rows={1} />;
}

/** The page's own shape while it loads, so nothing jumps when the data lands. */
function AppPageSkeleton() {
  return (
    <View className="gap-6 px-5 pt-2">
      <LockupSkeleton size="lg" />
      <Skeleton.Box width="100%" height={72} borderRadius={12} />
      <View className="flex-row gap-3">
        <Skeleton.Box width={232} height={502} borderRadius={24} />
        <Skeleton.Box width={232} height={502} borderRadius={24} />
      </View>
    </View>
  );
}
