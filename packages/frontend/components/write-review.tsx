import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@oxy.so/bloom/button';
import { RatingInput } from '@oxy.so/bloom/rating';
import { useTheme } from '@oxy.so/bloom/theme';
import { Text } from '@oxy.so/bloom/typography';
import { useAuth, useOxy } from '@oxy.so/services/ui/client';
import { useTranslation } from '../lib/i18n';
import { useDeleteMyStoreReview, useMyStoreReview, useWriteStoreReview } from '../lib/store';
import { useReviewSession } from '../lib/reviewSession';

/**
 * Writing a review is the only thing in Atlas that needs an account, so the
 * prompt lives here rather than in front of the whole app — and it opens the
 * SDK's in-app dialog instead of navigating anywhere.
 */
export function WriteReview({ slug }: { slug: string }) {
  const { user } = useAuth();
  const { oxyServices } = useOxy();
  const { epoch, subject } = useReviewSession(oxyServices);
  return (
    <ReviewSession
      key={JSON.stringify([slug, user?.id ?? null, epoch, subject])}
      slug={slug}
      subject={subject}
    />
  );
}

function ReviewSession({ slug, subject }: { slug: string; subject: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, canUsePrivateApi, signIn } = useAuth();
  const { data: mine } = useMyStoreReview(slug);
  const mutationAttempt = useRef(0);
  const write = useWriteStoreReview(slug, mutationAttempt);
  const remove = useDeleteMyStoreReview(slug, mutationAttempt);

  const [selection, setSelection] = useState<{ accountId: string; rating: number } | null>(null);
  const [error, setError] = useState<'write' | 'delete' | null>(null);
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const chosen =
    (selection?.accountId === user?.id ? selection?.rating : undefined) ?? mine?.rating ?? null;

  if (!canUsePrivateApi || !user) {
    return (
      <View className="flex-row">
        <Button appearance="subtle" tone="accent" onPress={() => void signIn()}>
          {t('app.signInToReview')}
        </Button>
      </View>
    );
  }

  if (subject !== user.id) {
    return <Text>{t('app.reviewSessionUnavailable')}</Text>;
  }

  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
      <Text variant="body-medium" style={{ color: colors.textSecondary }}>
        {mine ? t('app.yourRating') : t('app.tapToRate')}
      </Text>
      <RatingInput
        value={chosen}
        disabled={write.isPending || remove.isPending}
        accessibilityLabel={t('app.rateIt')}
        onChange={(rating) => {
          if (inFlight.current) return;
          inFlight.current = true;
          const currentAttempt = ++attempt.current;
          setError(null);
          setSelection({ accountId: user.id, rating });
          write.mutate(
            { rating, title: mine?.title ?? null, body: mine?.body ?? null },
            {
              onSuccess: () => {
                if (attempt.current === currentAttempt) setSelection(null);
              },
              onError: () => {
                if (attempt.current !== currentAttempt) return;
                setSelection(null);
                setError('write');
              },
              onSettled: () => {
                if (attempt.current === currentAttempt) inFlight.current = false;
              },
            },
          );
        }}
      />
      {mine ? (
        <Button
          appearance="plain"
          tone="accent"
          size="sm"
          loading={remove.isPending}
          disabled={write.isPending}
          onPress={() => {
            if (inFlight.current) return;
            inFlight.current = true;
            const currentAttempt = ++attempt.current;
            setError(null);
            remove.mutate(undefined, {
              onSuccess: () => {
                if (attempt.current === currentAttempt) setSelection(null);
              },
              onError: () => {
                if (attempt.current === currentAttempt) setError('delete');
              },
              onSettled: () => {
                if (attempt.current === currentAttempt) inFlight.current = false;
              },
            });
          }}
        >
          {t('app.withdrawReview')}
        </Button>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert">
          {t(error === 'write' ? 'app.reviewSaveFailed' : 'app.reviewDeleteFailed')}
        </Text>
      ) : null}
    </View>
  );
}
