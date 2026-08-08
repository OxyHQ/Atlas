import { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@oxyhq/bloom/avatar';
import { Button } from '@oxyhq/bloom/button';
import { Card } from '@oxyhq/bloom/card';
import { useAuth } from '@oxyhq/services';
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

export default function AppPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: app, isLoading, isError } = useStoreApp(slug);
  const { data: reviews } = useStoreReviews(slug);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !app) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
        <Text className="text-base text-muted-foreground">{t('app.notFound')}</Text>
        <Button variant="text" onPress={() => router.replace('/')}>
          {t('app.backToStore')}
        </Button>
      </View>
    );
  }

  const rating = formatRating(app.rating);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: app.name }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40, gap: 24 }}
      >
        <View className="flex-row items-center gap-4">
          <Avatar source={app.icon} variant="full" size={72} shape="squircle" name={app.name} />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-2xl font-bold text-foreground">{app.name}</Text>
            {app.tagline ? (
              <Text className="text-base text-muted-foreground">{app.tagline}</Text>
            ) : null}
            <View className="flex-row items-center gap-3">
              {app.category ? (
                <Text className="text-xs text-muted-foreground">{app.category.label}</Text>
              ) : null}
              {rating ? (
                <Text className="text-xs text-muted-foreground">
                  ★ {rating} · {t('app.reviewCount', { count: app.rating.count })}
                </Text>
              ) : (
                <Text className="text-xs text-muted-foreground">{t('app.noReviewsYet')}</Text>
              )}
            </View>
          </View>
        </View>

        {app.description ? (
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">{t('app.about')}</Text>
            {/* Markdown as written. Rendering it is a later pass; showing the
                text is better than showing nothing. */}
            <Text className="text-base leading-relaxed text-foreground">{app.description}</Text>
          </View>
        ) : null}

        <LinkRow label={t('app.website')} url={app.websiteUrl} />
        <LinkRow label={t('app.support')} url={app.supportUrl} />
        <LinkRow label={t('app.privacy')} url={app.privacyPolicyUrl} />
        <LinkRow label={t('app.terms')} url={app.termsUrl} />

        <WriteReview slug={slug} />

        <View className="gap-3">
          <Text className="text-lg font-semibold text-foreground">{t('app.reviews')}</Text>
          {(reviews?.items.length ?? 0) === 0 ? (
            <Text className="text-base text-muted-foreground">{t('app.beFirst')}</Text>
          ) : (
            reviews!.items.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </View>
      </ScrollView>
    </>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <Button variant="link" onPress={() => Linking.openURL(url)}>
      {label}
    </Button>
  );
}

/**
 * Writing a review is the only thing in Atlas that needs an account, so the
 * sign-in prompt lives here rather than in front of the whole app — and it opens
 * the SDK's in-app modal instead of navigating anywhere.
 */
function WriteReview({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { isAuthenticated, signIn } = useAuth();
  const { data: mine } = useMyStoreReview(slug);
  const write = useWriteStoreReview(slug);
  const remove = useDeleteMyStoreReview(slug);

  const [rating, setRating] = useState<number>(mine?.rating ?? 0);
  const chosen = rating || mine?.rating || 0;

  if (!isAuthenticated) {
    return (
      // `signIn()` opens the SDK's in-app account dialog on web and native
      // alike. Atlas never navigates to a login screen.
      <Button variant="secondary" onPress={() => void signIn()}>
        {t('app.signInToReview')}
      </Button>
    );
  }

  return (
    <Card variant="filled">
      <View className="gap-3 p-5">
        <Text className="text-base font-semibold text-foreground">
          {mine ? t('app.yourReview') : t('app.rateIt')}
        </Text>

        <View className="flex-row gap-1">
          {STARS.map((star) => (
            <Button
              key={star}
              variant="text"
              size="small"
              accessibilityLabel={t('app.starLabel', { count: star })}
              disabled={write.isPending}
              onPress={() => {
                setRating(star);
                write.mutate({ rating: star, body: mine?.body ?? null });
              }}
            >
              <Text className={star <= chosen ? 'text-2xl text-foreground' : 'text-2xl opacity-30'}>
                ★
              </Text>
            </Button>
          ))}
        </View>

        {mine ? (
          <Button variant="text" size="small" loading={remove.isPending} onPress={() => remove.mutate()}>
            {t('app.withdrawReview')}
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

function ReviewCard({ review }: { review: StoreReview }) {
  const { t } = useTranslation();

  return (
    <Card variant="filled">
      <View className="gap-2 p-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-base text-foreground">{'★'.repeat(review.rating)}</Text>
          <Text className="text-sm text-muted-foreground">
            {review.author.username ? `@${review.author.username}` : t('app.someone')}
          </Text>
          {/* Only ever shown when true. It is false for a first-party app nobody
              consents to, so its absence must not read as a demotion. */}
          {review.authorUsesApp ? (
            <Text className="text-xs text-muted-foreground">· {t('app.usesThisApp')}</Text>
          ) : null}
        </View>

        {review.title ? (
          <Text className="text-base font-semibold text-foreground">{review.title}</Text>
        ) : null}
        {review.body ? <Text className="text-base text-foreground">{review.body}</Text> : null}

        {review.reply ? (
          <View className="mt-1 gap-1 border-l-2 border-border pl-3">
            <Text className="text-xs font-semibold text-muted-foreground">
              {t('app.developerReply')}
            </Text>
            <Text className="text-sm text-foreground">{review.reply.body}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
