// biome-ignore-all lint/style/noNonNullAssertion: Each renderer and deferred handler is created before use.
import { afterEach, expect, mock, test } from 'bun:test';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let accountId: string | null = 'alice';
let tokenAccountId: string | null | undefined;
let epoch = 1;
let writes = 0;
let deletes = 0;
let reads = 0;
let resolveWrite!: (value: { rating: number }) => void;
const oxyServices = {
  http: { getSessionEpoch: () => epoch, addTokenChangeListener: () => () => {} },
  session: {
    get userId() {
      return tokenAccountId === undefined ? accountId : tokenAccountId;
    },
  },
  store: {
    reviews: {
      mine: async () => {
        reads++;
        return { rating: 2 };
      },
      write: async () => {
        writes++;
        return new Promise((resolve) => {
          resolveWrite = resolve;
        });
      },
      deleteMine: async () => {
        deletes++;
      },
    },
  },
};
mock.module('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices }),
  useAuth: () => ({ user: accountId ? { id: accountId } : null, canUsePrivateApi: !!accountId }),
}));
const hooks = await import('../packages/frontend/lib/store');
let latest: {
  read: ReturnType<typeof hooks.useMyStoreReview>;
  write: ReturnType<typeof hooks.useWriteStoreReview>;
  remove: ReturnType<typeof hooks.useDeleteMyStoreReview>;
};
function Host() {
  latest = {
    read: hooks.useMyStoreReview('app'),
    write: hooks.useWriteStoreReview('app'),
    remove: hooks.useDeleteMyStoreReview('app'),
  };
  return null;
}
let renderer: ReactTestRenderer | undefined;
let client: QueryClient | undefined;
const flush = async () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = undefined;
  client?.clear();
  accountId = 'alice';
  tokenAccountId = undefined;
  epoch = 1;
  writes = 0;
  deletes = 0;
  reads = 0;
});

test('a stale retained mutation cannot start in another account', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <Host />
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  const staleWrite = latest.write.mutate;
  const staleDelete = latest.remove.mutate;
  accountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await act(async () => {
    staleWrite({ rating: 5 });
    staleDelete();
  });
  await flush();
  expect(writes).toBe(0);
  expect(deletes).toBe(0);
  expect(latest.write.isPending).toBe(false);
});

test('a write result cannot be observed or repopulate the cache after A→B→A', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <Host />
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  let result!: Promise<unknown>;
  await act(async () => {
    result = latest.write.mutateAsync({ rating: 5 }).catch((error) => error);
  });
  expect(writes).toBe(1);
  accountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  expect(latest.write.isPending).toBe(false);
  accountId = 'alice';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await act(async () => client?.removeQueries({ queryKey: ['store-own-review', 'app', 'alice'] }));
  await act(async () => resolveWrite({ rating: 5 }));
  expect(await result).toBeInstanceOf(Error);
  expect(client.getQueryData(['store-own-review', 'app', 'alice'])).toBeUndefined();
});

test('the own-review query is disabled after sign-out', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <Host />
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  accountId = null;
  epoch++;
  await act(async () => renderer!.update(tree()));
  expect(latest.read.fetchStatus).toBe('idle');
  expect(latest.read.data).toBeUndefined();
});

test('a new bearer cannot execute A operations while auth still projects A', async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <Host />
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  const priorReads = reads;
  tokenAccountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await act(async () => {
    latest.write.mutate({ rating: 5 });
    latest.remove.mutate();
    await latest.read.refetch();
  });
  await flush();
  expect(writes).toBe(0);
  expect(deletes).toBe(0);
  expect(reads).toBe(priorReads);
});
