import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOxy } from '@oxyhq/services';
import type {
  StoreCategory,
  StoreListingDetail,
  StoreListingSummary,
  StoreOwnReview,
  StoreReview,
  WriteStoreReviewInput,
} from '@oxyhq/core';

/**
 * Atlas reads the store through `@oxyhq/core`'s store mixin, never a hand-rolled
 * request. The API has two response envelopes and the publisher's routes have a
 * third; the mixin is the one place that knows which is which, and reaching past
 * it is how a client ends up reporting a total of zero on every page.
 *
 * The reads need no session. They are gated on `isReady` only — not on
 * `isAuthenticated` — so the catalogue renders during cold boot rather than
 * flashing empty until a session resolves. Writing a review is the only thing
 * here that needs a signed-in account.
 */

export type {
  StoreCategory,
  StoreListingSummary,
  StoreListingDetail,
  StoreReview,
  StoreOwnReview,
};

const queryKeys = {
  categories: ['store', 'categories'] as const,
  apps: (category: string | undefined) => ['store', 'apps', category ?? null] as const,
  app: (slug: string) => ['store', 'app', slug] as const,
  reviews: (slug: string, sort: string) => ['store', 'reviews', slug, sort] as const,
  ownReview: (slug: string) => ['store', 'own-review', slug] as const,
};

/** The shelves, in the order the store curates them. */
export function useStoreCategories() {
  const { oxyServices, isAuthResolved } = useOxy();

  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => oxyServices.listStoreCategories(),
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
    queryFn: () => oxyServices.listStoreApps({ category, limit: 48 }),
    staleTime: 1000 * 60 * 2,
  });
}

/** One store page. */
export function useStoreApp(slug: string) {
  const { oxyServices } = useOxy();

  return useQuery({
    queryKey: queryKeys.app(slug),
    queryFn: () => oxyServices.getStoreApp(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 2,
  });
}

/** Visible reviews for an app, with the publisher's replies. */
export function useStoreReviews(slug: string, sort: 'recent' | 'rating' = 'recent') {
  const { oxyServices } = useOxy();

  return useQuery({
    queryKey: queryKeys.reviews(slug, sort),
    queryFn: () => oxyServices.listStoreReviews(slug, { sort, limit: 20 }),
    enabled: !!slug,
    staleTime: 1000 * 60,
  });
}

/** The signed-in reader's own review, or null. Skipped entirely when signed out. */
export function useMyStoreReview(slug: string) {
  const { oxyServices, isAuthenticated } = useOxy();

  return useQuery({
    queryKey: queryKeys.ownReview(slug),
    queryFn: () => oxyServices.getMyStoreReview(slug),
    enabled: !!slug && isAuthenticated,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WriteStoreReviewInput) => oxyServices.writeStoreReview(slug, input),
    onSuccess: (review) => {
      queryClient.setQueryData(queryKeys.ownReview(slug), review);
      queryClient.invalidateQueries({ queryKey: ['store', 'reviews', slug] });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(slug) });
    },
  });
}

/** Withdraw the reader's own review. */
export function useDeleteMyStoreReview(slug: string) {
  const { oxyServices } = useOxy();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => oxyServices.deleteMyStoreReview(slug),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.ownReview(slug), null);
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
