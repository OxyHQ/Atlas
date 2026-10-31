// biome-ignore-all lint/style/noNonNullAssertion: Each renderer is created before use.
import { afterEach, expect, mock, test } from 'bun:test';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  setStoreInstaller,
  StoreInstallerError,
  type StoreInstaller,
  type StoreInstallState,
} from '@oxy.so/core';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

mock.module('react-native', () => ({ View: 'view' }));
mock.module('@oxy.so/bloom/alert-dialog', () => ({ AlertDialog: 'alert-dialog' }));
mock.module('@oxy.so/bloom/button', () => ({ Button: 'button' }));
mock.module('@oxy.so/bloom/stat-bar', () => ({ MeterRing: 'meter-ring' }));
mock.module('@oxy.so/bloom/theme', () => ({
  useTheme: () => ({ colors: { textSecondary: 'grey', primary: 'blue', border: 'line' } }),
}));
mock.module('@oxy.so/bloom/typography', () => ({ Text: 'text' }));
mock.module(resolve('packages/frontend/lib/i18n.tsx'), () => ({
  useTranslation: () => ({
    locale: 'en-US',
    t: (key: string, params?: Record<string, string>) =>
      params?.name ? `${key}(${params.name})` : key,
  }),
}));

const { InstallAction } = await import('../packages/frontend/components/install-action');

/** A machine's installer of the test's own: each listing's state, and what was asked of it. */
function machine(states: Record<string, StoreInstallState>, statusFails = false) {
  const asked: string[] = [];
  const listeners = new Set<(slug: string, state: StoreInstallState) => void>();
  let finishInstall: (outcome: 'installed' | 'declined') => void = () => {};
  let installError: unknown = null;
  const installer: StoreInstaller = {
    status: async (slugs) => {
      asked.push(`status ${slugs.join(',')}`);
      if (statusFails) throw new StoreInstallerError('serviceUnavailable');
      return Object.fromEntries(slugs.map((slug) => [slug, states[slug]]));
    },
    install: (slug) => {
      asked.push(`install ${slug}`);
      if (installError) return Promise.reject(installError);
      return new Promise((done) => {
        finishInstall = done;
      });
    },
    update: async (slug) => {
      asked.push(`update ${slug}`);
      return 'updated';
    },
    uninstall: async () => 'removed',
    open: async (slug) => {
      asked.push(`open ${slug}`);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updates: {
      current: () => null,
      read: async () => ({ updates: [], checking: false, lastChecked: null, checkFailed: false }),
      check: async () => ({ updates: [], checking: false, lastChecked: null, checkFailed: false }),
      apply: async () => {},
      applyAll: async () => {},
      subscribe: () => () => {},
    },
  };
  return {
    installer,
    asked,
    tell: (slug: string, state: StoreInstallState) => {
      states[slug] = state;
      for (const listener of listeners) listener(slug, state);
    },
    finish: (outcome: 'installed' | 'declined') => finishInstall(outcome),
    failInstall: (error: unknown) => {
      installError = error;
    },
  };
}

let renderer: ReactTestRenderer | null = null;

async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
  // The batched status, then its answer.
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 0));
  });
  return renderer!;
}

const button = (r: ReactTestRenderer) => r.root.findAllByType('button' as never)[0];
const text = (node: unknown): string =>
  typeof node === 'string'
    ? node
    : Array.isArray(node)
      ? node.map(text).join('')
      : (node as { children?: unknown })?.children
        ? text((node as { children: unknown }).children)
        : '';

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  setStoreInstaller(null);
});

// Each test uses listings of its own: the states are kept once for the app, as Atlas keeps them.

test('without an installer, the store shows what it always has', async () => {
  const r = await render(
    <InstallAction slug="none-a" name="A" fallback={<fallback-view>store.view</fallback-view>} />,
  );
  expect(text(r.toJSON())).toBe('store.view');
});

test('Get asks the machine to install; a ring while it installs; then Open, which opens it', async () => {
  const m = machine({ 'get-a': { state: 'notInstalled' } });
  setStoreInstaller(m.installer);
  const r = await render(<InstallAction slug="get-a" name="Notes" />);
  expect(button(r).props.accessibilityLabel).toBe('install.getApp(Notes)');
  expect(text(button(r).props.children)).toBe('install.get');

  // Pressed: the machine's sheet may be up, so the action waits as a spinner, never pressed twice.
  await act(async () => {
    button(r).props.onPress();
  });
  expect(m.asked).toContain('install get-a');
  expect(r.root.findAllByType('button' as never)).toHaveLength(0);
  const waiting = r.root.findByType('meter-ring' as never).props;
  expect(waiting.indeterminate).toBe(true);
  expect(waiting.accessibilityLabel).toBe('install.installing(Notes)');
  // Nothing in the store can stop the machine's install: no stop square.
  expect(waiting.onStop).toBeUndefined();

  // The person confirmed; the machine says how far it is.
  await act(async () => m.tell('get-a', { state: 'installing', fraction: 0.5 }));
  const ring = r.root.findByType('meter-ring' as never).props;
  expect(ring.indeterminate).toBe(false);
  expect(ring.value).toBe(0.5);

  await act(async () => {
    m.tell('get-a', { state: 'installed', version: '1.0.0' });
    m.finish('installed');
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(text(button(r).props.children)).toBe('install.open');
  await act(async () => {
    await button(r).props.onPress();
  });
  expect(m.asked).toContain('open get-a');
});

test('an installed app with a newer release says Update, and updates', async () => {
  const m = machine({
    'upd-a': {
      state: 'updateAvailable',
      version: '1.0.0',
      newVersion: '1.1.0',
      needsConsent: false,
    },
  });
  setStoreInstaller(m.installer);
  const r = await render(<InstallAction slug="upd-a" name="Notes" />);
  expect(text(button(r).props.children)).toBe('install.update');
  await act(async () => {
    await button(r).props.onPress();
  });
  expect(m.asked).toContain('update upd-a');
});

test('one the machine cannot run says so on its page, and falls back in a row', async () => {
  const m = machine({ 'na-a': { state: 'unavailable' }, 'na-b': { state: 'unavailable' } });
  setStoreInstaller(m.installer);
  const page = await render(<InstallAction slug="na-a" name="Notes" />);
  expect(page.root.findByProps({ testID: 'install-unavailable' })).toBeTruthy();
  expect(text(page.toJSON())).toBe('install.notAvailable');
  act(() => page.unmount());
  const row = await render(
    <InstallAction
      slug="na-b"
      name="Notes"
      size="sm"
      fallback={<fallback-view>store.view</fallback-view>}
    />,
  );
  expect(text(row.toJSON())).toBe('store.view');
});

test('when the machine cannot say, Get is offered, and what the machine told the person is not repeated', async () => {
  const m = machine({}, true);
  setStoreInstaller(m.installer);
  m.failInstall(new StoreInstallerError('serviceUnavailable', { told: true }));
  const r = await render(<InstallAction slug="svc-a" name="Notes" />);
  expect(text(button(r).props.children)).toBe('install.get');
  await act(async () => {
    await button(r).props.onPress();
  });
  expect(m.asked).toContain('install svc-a');
  expect(r.root.findByType('alert-dialog' as never).props.open).toBe(false);
  expect(text(button(r).props.children)).toBe('install.get');
});

test('a failure the machine did not tell the person is said in an alert', async () => {
  const m = machine({ 'err-a': { state: 'notInstalled' } });
  setStoreInstaller(m.installer);
  m.failInstall(new StoreInstallerError('failed'));
  const r = await render(<InstallAction slug="err-a" name="Notes" />);
  await act(async () => {
    await button(r).props.onPress();
  });
  const alert = r.root.findByType('alert-dialog' as never);
  expect(alert.props.open).toBe(true);
  expect(alert.props.title).toBe('install.failed.install(Notes)');
});

test('a shelf of listings asks the machine once', async () => {
  const m = machine({ 'batch-a': { state: 'notInstalled' }, 'batch-b': { state: 'unavailable' } });
  setStoreInstaller(m.installer);
  await render(
    <view>
      <InstallAction slug="batch-a" name="A" size="sm" />
      <InstallAction slug="batch-b" name="B" size="sm" />
    </view>,
  );
  expect(m.asked.filter((a) => a.startsWith('status'))).toEqual(['status batch-a,batch-b']);
});
