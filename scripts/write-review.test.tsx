// biome-ignore-all lint/style/noNonNullAssertion: Each renderer and deferred handler is created before use.
import { afterEach, expect, mock, test } from 'bun:test';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let accountId: string | null = 'alice';
let tokenAccountId: string | null | undefined;
let epoch = 1;
let failWrite = true;
let failDelete = false;
let writeImpl = async (_slug: string, input: { rating: number }) => {
  if (failWrite) throw new Error('offline');
  return { ...input, title: null, body: null };
};
let deleteImpl = async () => {
  if (failDelete) throw new Error('offline');
};
const oxyServices = {
  http: {
    getSessionEpoch: () => epoch,
    addTokenChangeListener: () => () => {},
  },
  session: {
    get userId() {
      return tokenAccountId === undefined ? accountId : tokenAccountId;
    },
  },
  store: {
    reviews: {
      mine: async () => ({ rating: accountId === 'bob' ? 3 : 2, title: null, body: null }),
      write: (slug: string, input: { rating: number }) => writeImpl(slug, input),
      deleteMine: () => deleteImpl(),
    },
  },
};
mock.module('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices }),
  useAuth: () => ({ user: accountId ? { id: accountId } : null, canUsePrivateApi: !!accountId }),
}));
mock.module('react-native', () => ({ View: 'view' }));
mock.module('@oxy.so/bloom/button', () => ({ Button: 'button' }));
mock.module('@oxy.so/bloom/rating', () => ({ RatingInput: 'rating-input' }));
mock.module('@oxy.so/bloom/theme', () => ({
  useTheme: () => ({ colors: { textSecondary: 'grey' } }),
}));
mock.module('@oxy.so/bloom/typography', () => ({ Text: 'text' }));
const { WriteReview } = await import('../packages/frontend/components/write-review');
const { LocaleProvider } = await import('../packages/frontend/lib/i18n');
let renderer: ReactTestRenderer | undefined;
let client: QueryClient | undefined;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = undefined;
  client?.clear();
  onlineManager.setOnline(true);
  accountId = 'alice';
  tokenAccountId = undefined;
  epoch = 1;
  failWrite = true;
  failDelete = false;
  writeImpl = async (_slug, input) => {
    if (failWrite) throw new Error('offline');
    return { ...input, title: null, body: null };
  };
  deleteImpl = async () => {
    if (failDelete) throw new Error('offline');
  };
});

test('the review controls are unavailable while bearer and projected account disagree', async () => {
  tokenAccountId = 'bob';
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client!}>
        <LocaleProvider>
          <WriteReview slug="app" />
        </LocaleProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  expect(renderer!.root.findAllByType('rating-input')).toHaveLength(0);
  expect(JSON.stringify(renderer!.toJSON())).toContain('until your account is verified');
});

test('an offline failed rating restores the previous value and shows an error', async () => {
  onlineManager.setOnline(false);
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'offlineFirst' },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client!}>
        <LocaleProvider>
          <WriteReview slug="app" />
        </LocaleProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(5));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  expect(JSON.stringify(renderer!.toJSON())).toContain('could not');
  const mutation = client!.getMutationCache().getAll()[0];
  expect(mutation?.options.mutationKey).toEqual(['store-write-review']);
  expect(mutation?.options.networkMode).toBe('always');
  expect(mutation?.options.retry).toBe(false);
  expect(mutation?.state.isPaused).toBe(false);
  failWrite = false;
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(4));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(4);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('could not');
});

test('a failed withdrawal keeps the rating and reports an error', async () => {
  failDelete = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => renderer!.root.findByType('button').props.onPress());
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  expect(JSON.stringify(renderer!.toJSON())).toContain('could not be withdrawn');
  failDelete = false;
  await act(async () => renderer!.root.findByType('button').props.onPress());
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBeNull();
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('could not be withdrawn');
});

test('a late result from A cannot restore its old selection or overwrite a new A session', async () => {
  let finishOld!: (value: { rating: number; title: null; body: null }) => void;
  let finishNew!: (value: { rating: number; title: null; body: null }) => void;
  let count = 0;
  writeImpl = async () =>
    new Promise((resolve) => {
      if (++count === 1) finishOld = resolve;
      else finishNew = resolve;
    });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(5));
  await flush();
  accountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(3);
  accountId = 'alice';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(4));
  await flush();
  await act(async () => finishOld({ rating: 5, title: null, body: null }));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(4);
  expect(
    client!.getQueryData<{ rating: number }>(['store-own-review', 'app', 'alice'])?.rating,
  ).toBe(2);
  await act(async () => finishNew({ rating: 4, title: null, body: null }));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(4);
});

test('a late withdrawal from A cannot clear the review of a new A session', async () => {
  let finishOld!: () => void;
  deleteImpl = async () =>
    new Promise((resolve) => {
      finishOld = resolve;
    });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => renderer!.root.findByType('button').props.onPress());
  await flush();
  accountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await flush();
  accountId = 'alice';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  await act(async () => finishOld());
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(2);
  expect(
    client!.getQueryData<{ rating: number }>(['store-own-review', 'app', 'alice'])?.rating,
  ).toBe(2);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('could not');
});

test('a late error from A does not show an error in B', async () => {
  let rejectOld!: (error: Error) => void;
  writeImpl = async () =>
    new Promise((_resolve, reject) => {
      rejectOld = reject;
    });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(5));
  await flush();
  accountId = 'bob';
  epoch++;
  await act(async () => renderer!.update(tree()));
  await flush();
  await act(async () => rejectOld(new Error('offline')));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(3);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('could not');
});

test('a second write is ignored until the first settles', async () => {
  const releases: Array<(value: { rating: number; title: null; body: null }) => void> = [];
  writeImpl = async () => new Promise((resolve) => releases.push(resolve));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(5));
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(4));
  await flush();
  expect(releases).toHaveLength(1);
  await act(async () => releases[0]!({ rating: 5, title: null, body: null }));
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(4));
  await flush();
  expect(releases).toHaveLength(2);
  await act(async () => releases[1]!({ rating: 4, title: null, body: null }));
  await flush();
  expect(renderer!.root.findByType('rating-input').props.value).toBe(4);
  expect(
    client!.getQueryData<{ rating: number }>(['store-own-review', 'app', 'alice'])?.rating,
  ).toBe(4);
});

test('a withdrawal in the same tick as a write is ignored until it settles', async () => {
  let finishWrite!: (value: { rating: number; title: null; body: null }) => void;
  let finishDelete!: () => void;
  writeImpl = async () =>
    new Promise((resolve) => {
      finishWrite = resolve;
    });
  deleteImpl = async () =>
    new Promise((resolve) => {
      finishDelete = resolve;
    });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => {
    renderer!.root.findByType('rating-input').props.onChange(5);
    renderer!.root.findByType('button').props.onPress();
  });
  await flush();
  expect(finishDelete).toBeUndefined();
  await act(async () => finishWrite({ rating: 5, title: null, body: null }));
  await flush();
  await act(async () => renderer!.root.findByType('button').props.onPress());
  await flush();
  await act(async () => finishDelete());
  await flush();
  expect(client!.getQueryData(['store-own-review', 'app', 'alice'])).toBeNull();
  expect(renderer!.root.findByType('rating-input').props.value).toBeNull();
});

test('a write in the same tick as a withdrawal is ignored until it settles', async () => {
  let finishWrite!: (value: { rating: number; title: null; body: null }) => void;
  let finishDelete!: () => void;
  writeImpl = async () =>
    new Promise((resolve) => {
      finishWrite = resolve;
    });
  deleteImpl = async () =>
    new Promise((resolve) => {
      finishDelete = resolve;
    });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client!}>
      <LocaleProvider>
        <WriteReview slug="app" />
      </LocaleProvider>
    </QueryClientProvider>
  );
  await act(async () => {
    renderer = create(tree());
  });
  await flush();
  await act(async () => {
    renderer!.root.findByType('button').props.onPress();
    renderer!.root.findByType('rating-input').props.onChange(4);
  });
  await flush();
  expect(finishWrite).toBeUndefined();
  await act(async () => finishDelete());
  await flush();
  await act(async () => renderer!.root.findByType('rating-input').props.onChange(4));
  await flush();
  await act(async () => finishWrite({ rating: 4, title: null, body: null }));
  await flush();
  expect(
    client!.getQueryData<{ rating: number }>(['store-own-review', 'app', 'alice'])?.rating,
  ).toBe(4);
  expect(renderer!.root.findByType('rating-input').props.value).toBe(4);
});
