// biome-ignore-all lint/style/noNonNullAssertion: The renderer and observed hook are initialized by act.
import { expect, mock, test } from 'bun:test';
// biome-ignore lint/correctness/noUnresolvedImports: Babel's package exports resolve in Bun; Biome does not follow its directory entry.
import { transformSync } from '@babel/core';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let userId = 'alice';
let bearerId: string | null = 'alice';
let epoch = 1;
const listeners = new Set<() => void>();
const oxyServices = {
  http: {
    getSessionEpoch: () => epoch,
    addTokenChangeListener: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  session: {
    get userId() {
      return bearerId;
    },
  },
  store: { reviews: { mine: async () => ({ owner: bearerId }) } },
};
mock.module('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices }),
  useAuth: () => ({ user: { id: userId }, canUsePrivateApi: true }),
}));
const filename = resolve(
  `packages/frontend/lib/.store-compiler-${process.pid}-${randomUUID()}.mjs`,
);
const source = readFileSync(resolve('packages/frontend/lib/store.ts'), 'utf8');
const transformed = transformSync(source, {
  filename: resolve('packages/frontend/lib/store.ts'),
  babelrc: false,
  configFile: false,
  plugins: [
    [require('babel-plugin-react-compiler'), { target: '19' }],
    // biome-ignore lint/correctness/noUnresolvedImports: Bun resolves this Babel package's directory entry.
    [require('@babel/plugin-transform-typescript'), { allExtensions: true }],
  ],
})?.code;
if (
  !transformed?.includes('react/compiler-runtime') ||
  !/function useMyStoreReview\([^)]*\)\s*\{\s*const \$ =/.test(transformed)
) {
  throw new Error('React Compiler did not compile useMyStoreReview');
}
writeFileSync(filename, transformed, { flag: 'wx' });
let useMyStoreReview: typeof import('../packages/frontend/lib/store').useMyStoreReview;
try {
  ({ useMyStoreReview } = await import(filename));
} finally {
  unlinkSync(filename);
}

test('compiled own-review query follows the new session on a stable HTTP instance', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let latest: { data: unknown };
  function Host() {
    latest = useMyStoreReview('app');
    return null;
  }
  const tree = () => (
    <QueryClientProvider client={client}>
      <Host />
    </QueryClientProvider>
  );
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(tree());
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(latest!.data).toEqual({ owner: 'alice' });
  userId = 'bob';
  bearerId = 'bob';
  epoch++;
  await act(async () => {
    for (const listener of [...listeners]) listener();
    renderer!.update(tree());
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(latest!.data).toEqual({ owner: 'bob' });
  await act(async () => renderer!.unmount());
  client.clear();
});

test('compiled query hides A when only the bearer changes, without a parent rerender', async () => {
  userId = 'alice';
  bearerId = 'alice';
  epoch = 1;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let latest: { data: unknown };
  function Host() {
    latest = useMyStoreReview('app');
    return null;
  }
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(latest!.data).toEqual({ owner: 'alice' });
  bearerId = 'bob';
  epoch++;
  await act(async () => {
    for (const listener of [...listeners]) listener();
  });
  expect(latest!.data).toBeUndefined();
  expect(client.getQueryData(['store-own-review', 'app', 'alice'])).toEqual({ owner: 'alice' });
  await act(async () => renderer!.unmount());
  client.clear();
});
