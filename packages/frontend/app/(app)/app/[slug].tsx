import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { Button } from '@oxyhq/bloom/button';
import { useAuth, useOxy } from '@oxyhq/services';
import { useTranslation } from '@/lib/i18n';
import {
  formatRating,
  useDeleteMyStoreReview,
  useMyStoreReview,
  useStoreApp,
  useStoreReviews,
  useWriteStoreReview,
  type StoreReview,
} from '@/lib/store';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * An app's page, in the App Store's order: identity and the action first, then
 * a strip of facts, then the pictures, then the words, then the reviews.
 *
 * That order is the useful part. Somebody arriving from a link decides in the
 * first screenful, so nothing above the screenshots is optional.
 */
export default function AppPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: app, isLoading, isError } = useStoreApp(slug);
  const { data: reviews } = useStoreReviews(slug);

  if (isLoading) return <AppPageSkeleton />;

  if (isError || !app) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-base text-muted-foreground">{t('app.notFound')}</Text>
        <Button variant="text" onPress={() => router.replace('/')}>
          {t('app.backToStore')}
        </Button>
      </View>
    );
  }

  const rating = formatRating(app.rating);
  const primaryUrl = app.websiteUrl;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: app.name }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Identity + action. */}
        <View className="flex-row items-start gap-4 px-5 pt-6">
          <Avatar source={app.icon} variant="full" size={110} shape="squircle" name={app.name} />
          <View className="min-w-0 flex-1 gap-2 pt-1">
            <View>
              <Text className="text-[22px] font-bold leading-7 text-foreground" numberOfLines={2}>
                {app.name}
              </Text>
              {app.tagline ? (
                <Text className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground" numberOfLines={2}>
                  {app.tagline}
                </Text>
              ) : null}
            </View>
            {primaryUrl ? (
              <View className="flex-row">
                <Button variant="primary" size="small" onPress={() => Linking.openURL(primaryUrl)}>
                  {t('app.open')}
                </Button>
              </View>
            ) : null}
          </View>
        </View>

        {/* The facts strip: what the App Store puts under the icon, in the same
            scrolling row so it never wraps into a ragged block. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 28, paddingVertical: 20 }}
        >
          <Fact
            label={t('app.reviewCount', { count: app.rating.count })}
            value={rating ?? '—'}
            caption={rating ? '★★★★★' : t('app.noReviewsYet')}
          />
          {app.category ? (
            <Fact label={t('app.category')} value={app.category.label} caption={t('store.title')} />
          ) : null}
          <Fact label={t('app.developer')} value="Oxy" caption={t('app.developerCaption')} />
        </ScrollView>

        {app.screenshots.length > 0 ? <Screenshots app={app} /> : null}

        {app.description ? (
          <View className="gap-2 px-5 pt-2">
            <Text className="text-[20px] font-bold tracking-[-0.2px] text-foreground">
              {t('app.about')}
            </Text>
            <Text className="text-[15px] leading-[21px] text-foreground">{app.description}</Text>
          </View>
        ) : null}

        <RatingsSummary app={app} />

        <View className="gap-3 px-5 pt-4">
          {(reviews?.items.length ?? 0) === 0 ? (
            <Text className="text-[15px] text-muted-foreground">{t('app.beFirst')}</Text>
          ) : (
            reviews!.items.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </View>

        <View className="px-5 pt-5">
          <WriteReview slug={slug} />
        </View>

        <View className="gap-1 px-5 pt-8">
          <LinkRow label={t('app.support')} url={app.supportUrl} />
          <LinkRow label={t('app.privacy')} url={app.privacyPolicyUrl} />
          <LinkRow label={t('app.terms')} url={app.termsUrl} />
        </View>
      </ScrollView>
    </>
  );
}

/** One column of the facts strip: a small label, a big value, a caption. */
function Fact({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <View className="gap-1">
      <Text className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
        {label}
      </Text>
      <Text className="text-[19px] font-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/**
 * The screenshots, as a horizontal run of tall cards.
 *
 * `getFileDownloadUrl` is the one place a file id becomes a URL — the same
 * chokepoint Bloom's `ImageResolver` calls for avatars. A screenshot is not an
 * avatar, so it uses the function directly rather than being forced through a
 * component built for round images.
 */
function Screenshots({ app }: { app: { screenshots: { id: string; fileId: string; caption: string | null }[] } }) {
  const { oxyServices } = useOxy();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}
    >
      {app.screenshots.map((shot) => (
        <View key={shot.id} className="gap-1.5">
          <Image
            source={{ uri: oxyServices.getFileDownloadUrl(shot.fileId, 'full') }}
            accessibilityLabel={shot.caption ?? undefined}
            resizeMode="cover"
            className="h-[420px] w-[236px] rounded-2xl bg-card"
          />
          {shot.caption ? (
            <Text className="w-[236px] text-[12px] text-muted-foreground" numberOfLines={1}>
              {shot.caption}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * The ratings block: the average, then a bar per star.
 *
 * The histogram is `ratingBreakdown`, which the API computes from the visible
 * reviews on every read — so a hidden review leaves the bars immediately rather
 * than when some counter is repaired. Absent keys are zero.
 */
function RatingsSummary({
  app,
}: {
  app: { rating: { average: number | null; count: number }; ratingBreakdown: Record<number, number> };
}) {
  const { t } = useTranslation();
  const average = formatRating(app.rating);
  const total = app.rating.count;

  return (
    <View className="gap-3 px-5 pt-8">
      <Text className="text-[20px] font-bold tracking-[-0.2px] text-foreground">
        {t('app.reviews')}
      </Text>

      {total === 0 ? (
        <Text className="text-[15px] text-muted-foreground">{t('app.noReviewsYet')}</Text>
      ) : (
        <View className="flex-row items-end gap-6">
          <View>
            <Text className="text-[54px] font-bold leading-[58px] text-foreground">{average}</Text>
            <Text className="text-[12px] text-muted-foreground">{t('app.outOfFive')}</Text>
          </View>

          <View className="flex-1 gap-1 pb-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = app.ratingBreakdown[star] ?? 0;
              return (
                <View key={star} className="flex-row items-center gap-2">
                  <Text className="w-8 text-[11px] text-muted-foreground">{'★'.repeat(1)}{star}</Text>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
                    <View
                      className="h-full rounded-full bg-foreground/60"
                      style={{ width: `${total === 0 ? 0 : Math.round((count / total) * 100)}%` }}
                    />
                  </View>
                </View>
              );
            })}
            <Text className="pt-1 text-right text-[12px] text-muted-foreground">
              {t('app.reviewCount', { count: total })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      className="flex-row items-center justify-between border-b border-border/50 py-3 active:opacity-70"
    >
      <Text className="text-[15px] text-foreground">{label}</Text>
      <Text className="text-[15px] text-muted-foreground">›</Text>
    </Pressable>
  );
}

/**
 * Writing a review is the only thing in Atlas that needs an account, so the
 * prompt lives here rather than in front of the whole app — and it opens the
 * SDK's in-app dialog instead of navigating anywhere.
 */
function WriteReview({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { isAuthenticated, signIn } = useAuth();
  const { data: mine } = useMyStoreReview(slug);
  const write = useWriteStoreReview(slug);
  const remove = useDeleteMyStoreReview(slug);

  const [rating, setRating] = useState<number>(0);
  const chosen = rating || mine?.rating || 0;

  if (!isAuthenticated) {
    return (
      <Button variant="secondary" onPress={() => void signIn()}>
        {t('app.signInToReview')}
      </Button>
    );
  }

  return (
    <View className="gap-3 rounded-2xl bg-card p-5">
      <Text className="text-[15px] font-semibold text-foreground">
        {mine ? t('app.yourReview') : t('app.rateIt')}
      </Text>

      <View className="flex-row gap-1">
        {STARS.map((star) => (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={t('app.starLabel', { count: star })}
            disabled={write.isPending}
            onPress={() => {
              setRating(star);
              write.mutate({ rating: star, body: mine?.body ?? null });
            }}
            className="px-1 active:opacity-60"
          >
            <Text className={star <= chosen ? 'text-3xl text-foreground' : 'text-3xl opacity-25'}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>

      {mine ? (
        <View className="flex-row">
          <Button variant="text" size="small" loading={remove.isPending} onPress={() => remove.mutate()}>
            {t('app.withdrawReview')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function ReviewCard({ review }: { review: StoreReview }) {
  const { t } = useTranslation();

  return (
    <View className="gap-1.5 border-b border-border/50 pb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] text-foreground">{'★'.repeat(review.rating)}</Text>
        <Text className="text-[12px] text-muted-foreground">
          {review.author.username ? `@${review.author.username}` : t('app.someone')}
          {/* Only ever shown when true. It is false for a first-party app nobody
              consents to, so its absence must not read as a demotion. */}
          {review.authorUsesApp ? ` · ${t('app.usesThisApp')}` : ''}
        </Text>
      </View>

      {review.title ? (
        <Text className="text-[15px] font-semibold text-foreground">{review.title}</Text>
      ) : null}
      {review.body ? (
        <Text className="text-[14px] leading-[19px] text-foreground">{review.body}</Text>
      ) : null}

      {review.reply ? (
        <View className="mt-1 gap-1 rounded-xl bg-card p-3">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
            {t('app.developerReply')}
          </Text>
          <Text className="text-[14px] leading-[19px] text-foreground">{review.reply.body}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The page's own shape while it loads, so nothing jumps when the data lands. */
function AppPageSkeleton() {
  return (
    <View className="flex-1 px-5 pt-6">
      <View className="flex-row items-start gap-4">
        <View className="h-[110px] w-[110px] rounded-[26px] bg-card" />
        <View className="flex-1 gap-2 pt-2">
          <View className="h-6 w-2/3 rounded-full bg-card" />
          <View className="h-4 w-full rounded-full bg-card" />
          <View className="mt-1 h-8 w-24 rounded-full bg-card" />
        </View>
      </View>
      <View className="mt-8 h-[420px] w-[236px] rounded-2xl bg-card" />
    </View>
  );
}
