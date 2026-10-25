import { QueryClient } from '@tanstack/react-query';
import type { AccountQueriesConfig } from '@oxy.so/services/ui';

/**
 * The app's React Query client, passed to `OxyProvider`. Offline-first so
 * queries and mutations queue and replay when connectivity returns (the SDK's
 * persistence layer restores the cache on cold boot).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 60_000,
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

/** The shared provider discards private review state on switch/logout. */
export const ATLAS_ACCOUNT_QUERIES: AccountQueriesConfig = {
  roots: [],
  memoryOnlyRoots: ['store-own-review'],
  mutationKeys: [['store-write-review'], ['store-delete-review']],
};
