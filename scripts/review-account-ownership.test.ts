// biome-ignore-all lint/style/noNonNullAssertion: The test asserts that hydration created the mutation.
import { afterEach, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { QueryClient, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
import { ATLAS_ACCOUNT_QUERIES, queryClient } from '../packages/frontend/lib/queryClient';

const sdk =
  process.env.ATLAS_AUDIT_SERVICES_DIR ?? dirname(require.resolve('@oxy.so/services/package.json'));
const { createAccountQueryPersistence, accountQueryOwnership } = require(
  join(sdk, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { attachQueryPersistence } = require(join(sdk, 'lib/commonjs/ui/hooks/queryClient.js'));

const clients: QueryClient[] = [];
afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.clear();
});

test('offline-first without a retry fails the first offline attempt instead of queueing it', async () => {
  onlineManager.setOnline(false);
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  clients.push(client);
  const mutation = client.getMutationCache().build(client, {
    mutationKey: ['store-write-review'],
    mutationFn: async () => {
      throw new Error('offline');
    },
  });
  await expect(mutation.execute({ rating: 4 })).rejects.toThrow('offline');
  expect(mutation.state.status).toBe('error');
  expect(mutation.state.isPaused).toBe(false);
});

function pausedReview() {
  const client = new QueryClient();
  clients.push(client);
  const mutation = client.getMutationCache().build(client, {
    mutationKey: ['store-write-review'],
    mutationFn: async () => undefined,
  });
  mutation.state = {
    ...mutation.state,
    status: 'pending',
    isPaused: true,
    variables: { rating: 4, body: 'private pending review' },
  };
  return { client, mutation };
}

test('review mutation keys are classified as account-owned', () => {
  const { mutation } = pausedReview();
  expect(accountQueryOwnership(ATLAS_ACCOUNT_QUERIES).ownsMutation(mutation)).toBe(true);
});

test('a pending review is removed when switching accounts', async () => {
  const { client, mutation } = pausedReview();
  const storage = {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
  const persistence = createAccountQueryPersistence(client, ATLAS_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  try {
    persistence.activate('alice');
    await persistence.whenReady();
    persistence.activate('bob');
    await persistence.whenReady();
    expect(client.getMutationCache().getAll()).not.toContain(mutation);
  } finally {
    persistence.detach();
  }
});

test('an explicitly attached shared persistor excludes a paused registered review', async () => {
  const { client: seed } = pausedReview();
  const client = new QueryClient();
  clients.push(client);
  const entries = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => void entries.set(key, value),
    removeItem: async (key: string) => void entries.delete(key),
  };
  const shared = attachQueryPersistence(client, storage, ATLAS_ACCOUNT_QUERIES);
  await shared.restored;
  try {
    hydrate(client, dehydrate(seed, { shouldDehydrateMutation: () => true }));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(entries.get('oxy_query_cache_v3')).not.toContain('private pending review');
  } finally {
    shared.unsubscribe();
  }
});

test('an explicitly attached shared persistor excludes a successful registered review', async () => {
  const client = new QueryClient();
  clients.push(client);
  const entries = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => void entries.set(key, value),
    removeItem: async (key: string) => void entries.delete(key),
  };
  const shared = attachQueryPersistence(client, storage, ATLAS_ACCOUNT_QUERIES);
  await shared.restored;
  try {
    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['store-write-review'],
      mutationFn: async () => ({ id: 'review' }),
    });
    await mutation.execute({ rating: 4, body: 'submitted review text' });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(entries.get('oxy_query_cache_v3')).not.toContain('submitted review text');
  } finally {
    shared.unsubscribe();
  }
});

test('a restored paused review has no unguarded default replay function', async () => {
  const { client: seed } = pausedReview();
  const client = new QueryClient();
  clients.push(client);
  hydrate(client, dehydrate(seed, { shouldDehydrateMutation: () => true }));
  const restored = client.getMutationCache().getAll()[0];
  await expect(restored!.continue()).rejects.toThrow('No mutationFn found');
});

test('a hypothetical shared persistor preserves legacy mutations without granting replay', async () => {
  const seed = new QueryClient();
  clients.push(seed);
  const legacy = seed.getMutationCache().build(seed, {
    mutationKey: ['store-write-review', 'legacy-app', 'alice'],
    mutationFn: async () => undefined,
  });
  legacy.state = {
    ...legacy.state,
    status: 'pending',
    isPaused: true,
    variables: { body: 'legacy review to preserve' },
  };
  const entries = new Map([
    [
      'oxy_query_cache_v3',
      JSON.stringify({
        buster: 'unversioned',
        timestamp: Date.now(),
        clientState: dehydrate(seed, { shouldDehydrateMutation: () => true }),
      }),
    ],
  ]);
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => void entries.set(key, value),
    removeItem: async (key: string) => void entries.delete(key),
  };
  const client = new QueryClient();
  clients.push(client);
  const shared = attachQueryPersistence(client, storage, ATLAS_ACCOUNT_QUERIES);
  await shared.restored;
  try {
    const restored = client.getMutationCache().getAll()[0];
    expect(restored?.options.mutationFn).toBeUndefined();
    const current = client.getMutationCache().build(client, {
      mutationKey: ['store-write-review'],
      mutationFn: async () => undefined,
    });
    await current.execute({ body: 'new review not in shared cache' });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const snapshot = entries.get('oxy_query_cache_v3');
    expect(snapshot).toContain('legacy review to preserve');
    expect(snapshot).not.toContain('new review not in shared cache');
  } finally {
    shared.unsubscribe();
  }
});
