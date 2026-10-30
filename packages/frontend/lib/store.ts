import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOxy } from '@oxy.so/services/ui/client';
import type {
  StoreCategory,
  StoreListingDetail,
  StoreListingSummary,
  StoreOwnReview,
  StoreReview,
  WriteStoreReviewInput,
} from '@oxy.so/core';

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
  const epoch = oxyServices.http.getSessionEpoch();

  return useQuery({
    queryKey: queryKeys.ownReview(slug, accountId),
    queryFn: () => {
      if (epoch !== oxyServices.http.getSessionEpoch()) throw new Error('Account changed');
      return oxyServices.store.reviews.mine(slug);
    },
    enabled: !!slug && canUsePrivateApi && !!accountId,
    staleTime: 1000 * 30,
  });
}

/**
 * Write or replace the reader's review.
 *
 * Invalidates the app as well as its reviews: the rating is computed from the
 * visible reviews on every read, so a new review changes the number on the page
 * it was written from.
 */
export function useWriteStoreReview(slug: string) {
  const { oxyServices } = useOxy();
  const { user, canUsePrivateApi } = useAuth();
  const accountId = user?.id ?? null;
  const epoch = oxyServices.http.getSessionEpoch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['store-write-review', slug, accountId],
    mutationFn: async (input: WriteStoreReviewInput) => {
      if (!canUsePrivateApi || !accountId || epoch !== oxyServices.http.getSessionEpoch())
        throw new Error('Account changed');
      const review = await oxyServices.store.reviews.write(slug, input);
      return { review, accountId };
    },
    onSuccess: ({ review, accountId: owner }) => {
      queryClient.setQueryData(queryKeys.ownReview(slug, owner), review);
      queryClient.invalidateQueries({ queryKey: ['store', 'reviews', slug] });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(slug) });
    },
  });
}

/** Withdraw the reader's own review. */
export function useDeleteMyStoreReview(slug: string) {
  const { oxyServices } = useOxy();
  const { user, canUsePrivateApi } = useAuth();
  const accountId = user?.id ?? null;
  const epoch = oxyServices.http.getSessionEpoch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['store-delete-review', slug, accountId],
    mutationFn: async () => {
      if (!canUsePrivateApi || !accountId || epoch !== oxyServices.http.getSessionEpoch())
        throw new Error('Account changed');
      await oxyServices.store.reviews.deleteMine(slug);
      return { accountId };
    },
    onSuccess: ({ accountId: owner }) => {
      queryClient.setQueryData(queryKeys.ownReview(slug, owner), null);
      queryClient.invalidateQueries({ queryKey: ['store', 'reviews', slug] });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(slug) });
    },
  });
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
