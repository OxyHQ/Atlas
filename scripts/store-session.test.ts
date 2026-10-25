import { beforeEach, expect, mock, test } from 'bun:test';

let accountId: string | null = 'account-a';
let epoch = 1;
let calls = 0;
const cache = new Map<string, unknown>();
const oxyServices = {
  http: { getSessionEpoch: () => epoch },
  store: {
    reviews: {
      mine: async () => {
        calls++;
        return { accountId };
      },
      write: async () => {
        calls++;
        return { id: 'review-a' };
      },
      deleteMine: async () => {
        calls++;
      },
    },
  },
};
mock.module('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices }),
  useAuth: () => ({ user: accountId ? { id: accountId } : null, canUsePrivateApi: !!accountId }),
}));
mock.module('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({
    setQueryData: (key: readonly unknown[], value: unknown) =>
      cache.set(JSON.stringify(key), value),
    invalidateQueries: () => Promise.resolve(),
  }),
}));
const hooks = await import('../packages/frontend/lib/store');
// Exercise the hook's query/mutation boundary with a controlled shared session.
// React scheduling is irrelevant to these queued calls and cache destinations.
type Query = { queryKey: readonly unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
type Mutation = {
  mutationFn: (input?: unknown) => Promise<unknown>;
  onSuccess: (result: unknown) => void;
};
beforeEach(() => {
  accountId = 'account-a';
  epoch = 1;
  calls = 0;
  cache.clear();
});

test('own-review cache changes with account and is disabled on logout', () => {
  const first = hooks.useMyStoreReview('app') as unknown as Query;
  accountId = 'account-b';
  epoch++;
  const second = hooks.useMyStoreReview('app') as unknown as Query;
  expect(first.queryKey).not.toEqual(second.queryKey);
  accountId = null;
  epoch++;
  const signedOut = hooks.useMyStoreReview('app') as unknown as Query;
  expect(signedOut.enabled).toBe(false);
  expect(() => first.queryFn()).toThrow('Account changed');
  expect(calls).toBe(0);
});

test('queued writes and deletes cannot run with a replacement session', async () => {
  const write = hooks.useWriteStoreReview('app') as unknown as Mutation;
  const remove = hooks.useDeleteMyStoreReview('app') as unknown as Mutation;
  accountId = 'account-b';
  epoch++;
  await expect(write.mutationFn({ rating: 5 })).rejects.toThrow('Account changed');
  await expect(remove.mutationFn()).rejects.toThrow('Account changed');
  expect(calls).toBe(0);
});

test('completed mutation updates only its originating account cache after a switch', async () => {
  const original = hooks.useWriteStoreReview('app') as unknown as Mutation;
  const result = await original.mutationFn({ rating: 5 });
  accountId = 'account-b';
  epoch++;
  const current = hooks.useWriteStoreReview('app') as unknown as Mutation;
  current.onSuccess(result);
  expect(cache.get(JSON.stringify(['store-own-review', 'app', 'account-a']))).toEqual({
    id: 'review-a',
  });
  expect(cache.has(JSON.stringify(['store-own-review', 'app', 'account-b']))).toBe(false);
});
