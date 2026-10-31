import { useLayoutEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type MutateOptions } from '@tanstack/react-query';
import { useAuth, useOxy } from '@oxy.so/services/ui/client';
import type {
  StoreCategory,
  StoreListingDetail,
  StoreListingSummary,
  StoreOwnReview,
  StoreReview,
  WriteStoreReviewInput,
} from '@oxy.so/core';
import { ATLAS_REVIEW_MUTATION_KEYS } from './reviewKeys';
import { useReviewSession } from './reviewSession';

/**
 * Atlas reads the store through `@oxy.so/core`'s store mixin, never a hand-rolled
 * request. The API has two response envelopes and the publisher's routes have a
 * third; the mixin is the one place that knows which is which, and reaching past
 * it is how a client ends up reporting a total of zero on every page.
 *
 * The reads need no session. They are gated on `isReady` only — not on
 * `isAuthenticated` — so the catalogue renders during cold boot rather than
 * flashing empty until a session resolves. Writing a review is the only thing
 * here that needs a signed-in account.
 */

export type { StoreCategory, StoreListingSummary, StoreListingDetail, StoreReview, StoreOwnReview };

const queryKeys = {
  categories: ['store', 'categories'] as const,
  apps: (category: string | undefined) => ['store', 'apps', category ?? null] as const,
  app: (slug: string) => ['store', 'app', slug] as const,
  reviews: (slug: string, sort: string) => ['store', 'reviews', slug, sort] as const,
  ownReview: (slug: string, accountId: string | null) =>
    ['store-own-review', slug, accountId] as const,
};

/** The shelves, in the order the store curates them. */
export function useStoreCategories() {
  const { oxyServices, isAuthResolved } = useOxy();

  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => oxyServices.store.categories(),
    // Not gated on a session: the shelves are public and the storefront should
    // not wait for cold boot to draw them.
    enabled: isAuthResolved !== undefined,
    staleTime: 1000 * 60 * 10,
  });
}

/** Published apps, newest first, optionally one shelf. */
export function useStoreApps(category?: string) {
  const { oxyServices } = useOxy();

  return useQuery({
    queryKey: queryKeys.apps(category),
    // The API's ceiling. The storefront groups one read in memory rather than
    // asking once per shelf.
    queryFn: () => oxyServices.store.apps({ category, limit: 100 }),
    staleTime: 1000 * 60 * 2,
  });
}

/** One store page. */
export function useStoreApp(slug: string) {
  const { oxyServices } = useOxy();

  return useQuery({
    queryKey: queryKeys.app(slug),
    queryFn: () => oxyServices.store.app(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 2,
  });
}

/** Visible reviews for an app, with the publisher's replies. */
export function useStoreReviews(slug: string, sort: 'recent' | 'rating' = 'recent') {
  const { oxyServices } = useOxy();

  return useQuery({
    queryKey: queryKeys.reviews(slug, sort),
    queryFn: () => oxyServices.store.reviews.list(slug, { sort, limit: 20 }),
    enabled: !!slug,
    staleTime: 1000 * 60,
  });
}

/** The signed-in reader's own review, or null. Skipped entirely when signed out. */
export function useMyStoreReview(slug: string) {
  const { oxyServices } = useOxy();
  const { user, canUsePrivateApi } = useAuth();
  const accountId = user?.id ?? null;
  const { epoch, subject } = useReviewSession(oxyServices);
  const sameSubject = accountId !== null && subject === accountId;

  const query = useQuery({
    queryKey: queryKeys.ownReview(slug, accountId),
    queryFn: () => {
      if (epoch !== oxyServices.http.getSessionEpoch() || oxyServices.session.userId !== accountId)
        throw new Error('Account changed');
      return oxyServices.store.reviews.mine(slug);
    },
    enabled: !!slug && canUsePrivateApi && sameSubject,
    staleTime: 1000 * 30,
  });
  return { ...query, data: canUsePrivateApi && sameSubject ? query.data : undefined };
}

/**
 * Write or replace the reader's review.
 *
 * Invalidates the app as well as its reviews: the rating is computed from the
 * visible reviews on every read, so a new review changes the number on the page
 * it was written from.
 */
export function useWriteStoreReview(slug: string, sharedAttempt?: { current: number }) {
  return useOwnedReviewMutation<WriteStoreReviewInput, StoreOwnReview>(
    slug,
    'write',
    sharedAttempt,
  );
}

/** Withdraw the reader's own review. */
export function useDeleteMyStoreReview(slug: string, sharedAttempt?: { current: number }) {
  return useOwnedReviewMutation<void, void>(slug, 'delete', sharedAttempt);
}

type ReviewOwner = {
  slug: string;
  accountId: string | null;
  enabled: boolean;
  epoch: number;
  oxyServices: ReturnType<typeof useOxy>['oxyServices'];
};
type ReviewVariables<T> = { input: T };
const reviewOwners = new WeakMap<object, ReviewOwner>();
function sameReviewOwner(first: ReviewOwner | undefined, second: ReviewOwner | null): boolean {
  return (
    !!first?.accountId &&
    first.enabled &&
    !!second &&
    second.enabled &&
    first.oxyServices === second.oxyServices &&
    first.accountId === second.accountId &&
    first.slug === second.slug &&
    first.epoch === second.epoch
  );
}

/** Review mutations are memory-only and must never run under a replacement session. */
function useOwnedReviewMutation<TInput, TResult>(
  slug: string,
  operation: 'write' | 'delete',
  sharedAttempt?: { current: number },
) {
  const { oxyServices } = useOxy();
  const { user, canUsePrivateApi } = useAuth();
  const accountId = user?.id ?? null;
  const { epoch, subject } = useReviewSession(oxyServices);
  const queryClient = useQueryClient();
  const current = useRef<ReviewOwner | null>(null);
  const ownAttempt = useRef(0);
  const latestAttempt = sharedAttempt ?? ownAttempt;
  const enabled = canUsePrivateApi && accountId !== null && subject === accountId;
  const owner = { slug, accountId, enabled, epoch, oxyServices };
  useLayoutEffect(() => {
    current.current = { slug, accountId, enabled, epoch, oxyServices };
    return () => {
      current.current = null;
    };
  }, [slug, accountId, enabled, epoch, oxyServices]);

  const owns = (variables: ReviewVariables<TInput>) => {
    const started = reviewOwners.get(variables);
    const active = current.current;
    return (
      !!started &&
      sameReviewOwner(started, active) &&
      started.epoch === started.oxyServices.http.getSessionEpoch() &&
      started.oxyServices.session.userId === started.accountId
    );
  };
  const attempts = useRef(new WeakMap<object, number>());
  const ownsLatest = (variables: ReviewVariables<TInput>) =>
    owns(variables) && attempts.current.get(variables) === latestAttempt.current;
  const mutation = useMutation<TResult, Error, ReviewVariables<TInput>>({
    mutationKey: ATLAS_REVIEW_MUTATION_KEYS[operation],
    networkMode: 'always',
    retry: false,
    mutationFn: async (variables) => {
      const started = reviewOwners.get(variables);
      if (!started || !owns(variables)) throw new Error('Account changed');
      const result =
        operation === 'write'
          ? await started.oxyServices.store.reviews.write(
              started.slug,
              variables.input as WriteStoreReviewInput,
            )
          : await started.oxyServices.store.reviews.deleteMine(started.slug);
      if (!owns(variables)) throw new Error('Account changed');
      return result as TResult;
    },
    onSuccess: (result, variables) => {
      const started = reviewOwners.get(variables);
      if (!started || !ownsLatest(variables)) return;
      queryClient.setQueryData(
        queryKeys.ownReview(started.slug, started.accountId),
        operation === 'write' ? result : null,
      );
      void queryClient.invalidateQueries({ queryKey: ['store', 'reviews', started.slug] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.app(started.slug) });
    },
  });
  const prepare = (input: TInput, options?: MutateOptions<TResult, Error, TInput>) => {
    const variables = { input };
    reviewOwners.set(variables, owner);
    attempts.current.set(variables, ++latestAttempt.current);
    const adapted: MutateOptions<TResult, Error, ReviewVariables<TInput>> | undefined = options && {
      onSuccess: (data, vars, context, mutationContext) => {
        if (ownsLatest(vars)) options.onSuccess?.(data, vars.input, context, mutationContext);
      },
      onError: (error, vars, context, mutationContext) => {
        if (ownsLatest(vars)) options.onError?.(error, vars.input, context, mutationContext);
      },
      onSettled: (data, error, vars, context, mutationContext) => {
        if (ownsLatest(vars))
          options.onSettled?.(data, error, vars.input, context, mutationContext);
      },
    };
    return { variables, adapted };
  };
  const visible =
    !mutation.variables || sameReviewOwner(reviewOwners.get(mutation.variables), owner);
  return {
    ...mutation,
    ...(!visible
      ? {
          data: undefined,
          error: null,
          failureCount: 0,
          failureReason: null,
          isError: false,
          isIdle: true,
          isPaused: false,
          isPending: false,
          isSuccess: false,
          status: 'idle' as const,
          submittedAt: 0,
        }
      : {}),
    variables: visible ? mutation.variables?.input : undefined,
    mutate: (input: TInput, options?: MutateOptions<TResult, Error, TInput>) => {
      const { variables, adapted } = prepare(input, options);
      mutation.mutate(variables, adapted);
    },
    mutateAsync: (input: TInput, options?: MutateOptions<TResult, Error, TInput>) => {
      const { variables, adapted } = prepare(input, options);
      return mutation.mutateAsync(variables, adapted).then(
        (result) => {
          if (!ownsLatest(variables)) throw new Error('Account changed');
          return result;
        },
        (error: unknown) => {
          if (!ownsLatest(variables)) throw new Error('Account changed');
          throw error;
        },
      );
    },
  };
}

/**
 * A rating rendered as text.
 *
 * `average` is `null` when nobody has reviewed an app — never `0` — so this
 * returns null rather than "0.0", and the caller draws nothing instead of
 * drawing a one-star app that has no reviews.
 */
export function formatRating(rating: { average: number | null; count: number }): string | null {
  if (rating.average === null) return null;
  return rating.average.toFixed(1);
}

/** A shelf of the storefront: a category and its published apps, newest first. */
export interface StoreShelf {
  category: StoreCategory;
  apps: StoreListingSummary[];
}

export interface Storefront {
  categories: StoreCategory[];
  /** Every published app, newest first (the API's order). */
  apps: StoreListingSummary[];
  /** One shelf per category that has an app on it, in the store's curated order. */
  shelves: StoreShelf[];
  /**
   * The chart: apps people have rated, best first (average, then how many
   * ratings it rests on). An unrated app is not on it: it has no rating to
   * rank, and ranking it last would read as rated worst.
   */
  topRated: StoreListingSummary[];
}

/**
 * What the storefront shows, derived from the two public reads and nothing
 * else. Pure, so every page that shows the catalogue organises it the same way.
 */
export function organiseStorefront(
  apps: readonly StoreListingSummary[],
  categories: readonly StoreCategory[],
): Storefront {
  const byCategory = new Map<string, StoreListingSummary[]>();
  for (const app of apps) {
    if (!app.category) continue;
    const shelf = byCategory.get(app.category.slug);
    if (shelf) shelf.push(app);
    else byCategory.set(app.category.slug, [app]);
  }
  const topRated = apps
    .filter((app) => app.rating.average !== null)
    .sort(
      (a, b) =>
        (b.rating.average ?? 0) - (a.rating.average ?? 0) || b.rating.count - a.rating.count,
    );
  return {
    categories: [...categories],
    apps: [...apps],
    shelves: categories
      .map((category) => ({ category, apps: byCategory.get(category.slug) ?? [] }))
      .filter((shelf) => shelf.apps.length > 0),
    topRated,
  };
}

/** The storefront's two reads, organised. */
export function useStorefront() {
  const categories = useStoreCategories();
  const apps = useStoreApps();
  const storefront = useMemo(
    () => organiseStorefront(apps.data?.items ?? [], categories.data ?? []),
    [apps.data, categories.data],
  );
  return {
    ...storefront,
    isLoading: apps.isLoading,
    isError: apps.isError,
    refetch: apps.refetch,
  };
}

/** A count in the reader's digits and grouping: 1284 → "1,284" (en), "1.284" (de). */
export function formatCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(count);
}
