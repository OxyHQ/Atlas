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

/** What the screen reader was told, in order. */
const announced: string[] = [];
mock.module('react-native', () => ({
  View: 'view',
  AccessibilityInfo: { announceForAccessibility: (text: string) => announced.push(text) },
}));
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
    t: (key: string, params?: Record<string, string | number>) =>
      params?.name
        ? `${key}(${params.name}${params.percent === undefined ? '' : `, ${params.percent}`})`
        : key,
  }),
}));

const { InstallAction } = await import('../packages/frontend/components/install-action');
const { InstallNarration, QUIET_MS } = await import('../packages/frontend/lib/install-narration');

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
  announced.length = 0;
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

/** The ring the action's button draws (its icon, hidden from assistive technologies in a view). */
const ring = (r: ReactTestRenderer) => {
  const icon = button(r).props.icon as React.ReactElement<{
    'aria-hidden'?: boolean;
    children: React.ReactElement<Record<string, unknown>>;
  }>;
  expect(icon.props['aria-hidden']).toBe(true);
  expect(icon.props.children.type).toBe('meter-ring' as never);
  return icon.props.children.props;
};

test('Get asks the machine to install; the same control rings while it installs, then is Open', async () => {
  const m = machine({ 'get-a': { state: 'notInstalled' } });
  setStoreInstaller(m.installer);
  const r = await render(<InstallAction slug="get-a" name="Notes" />);
  const control = button(r);
  expect(control.props.accessibilityLabel).toBe('install.getApp(Notes)');
  expect(text(control.props.children)).toBe('install.get');

  // Pressed: the machine's sheet may be up, so the action waits as a spinner, never pressed twice.
  await act(async () => {
    button(r).props.onPress();
  });
  expect(m.asked).toContain('install get-a');
  // The same control, so the keyboard's focus and the screen reader's stay on it.
  expect(button(r)).toBe(control);
  expect(button(r).props.onPress).toBeUndefined();
  expect(button(r).props.accessibilityLabel).toBe('install.installing(Notes)');
  expect(ring(r).indeterminate).toBe(true);
  // Nothing in the store can stop the machine's install: no stop square.
  expect(ring(r).onStop).toBeUndefined();
  // Nothing is said while the machine's sheet asks.
  expect(announced).toEqual([]);

  // The person confirmed; the machine says how far it is: said as it starts, once.
  await act(async () => m.tell('get-a', { state: 'installing', fraction: 0.5 }));
  expect(ring(r).indeterminate).toBe(false);
  expect(ring(r).value).toBe(0.5);
  expect(announced).toEqual(['install.installing(Notes)']);
  // Every step of its progress is drawn, and none said a moment after the start.
  await act(async () => m.tell('get-a', { state: 'installing', fraction: 0.8 }));
  await act(async () => m.tell('get-a', { state: 'installing', fraction: 1 }));
  await act(async () => m.tell('get-a', { state: 'installing', fraction: null }));
  expect(ring(r).indeterminate).toBe(true);
  expect(announced).toEqual(['install.installing(Notes)']);

  await act(async () => {
    m.tell('get-a', { state: 'installed', version: '1.0.0' });
    m.finish('installed');
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(button(r)).toBe(control);
  expect(text(button(r).props.children)).toBe('install.open');
  expect(button(r).props.accessibilityLabel).toBe('install.openApp(Notes)');
  expect(announced).toEqual(['install.installing(Notes)', 'install.installed(Notes)']);
  await act(async () => {
    await button(r).props.onPress();
  });
  expect(m.asked).toContain('open get-a');
  // Opening says nothing: the application's window does.
  expect(announced).toHaveLength(2);
});

test("declined in the machine's sheet: Get again, on the same control, and nothing said", async () => {
  const m = machine({ 'decl-a': { state: 'notInstalled' } });
  setStoreInstaller(m.installer);
  const r = await render(<InstallAction slug="decl-a" name="Notes" />);
  const control = button(r);
  await act(async () => {
    button(r).props.onPress();
  });
  await act(async () => {
    m.finish('declined');
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(button(r)).toBe(control);
  expect(text(button(r).props.children)).toBe('install.get');
  expect(announced).toEqual([]);
});

test('Get pressed from the keyboard: its start is said by the focus coming back from the sheet, not again', async () => {
  const m = machine({ 'key-a': { state: 'notInstalled' } });
  setStoreInstaller(m.installer);
  const r = await render(<InstallAction slug="key-a" name="Notes" />);
  act(() => button(r).props.onFocus());
  await act(async () => {
    button(r).props.onPress();
  });
  await act(async () => m.tell('key-a', { state: 'installing', fraction: 0 }));
  expect(button(r).props.accessibilityLabel).toBe('install.installing(Notes)');
  expect(announced).toEqual([]);
  await act(async () => {
    m.tell('key-a', { state: 'installed', version: '1.0.0' });
    m.finish('installed');
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(announced).toEqual(['install.installed(Notes)']);
});

test('a slow install is said at the quarters it reaches, never more often than the pause', () => {
  let now = 0;
  const said: string[] = [];
  const narration = new InstallNarration(
    {
      started: 'Installing Notes',
      progress: (percent) => `Installing Notes, ${percent}%`,
      done: 'Notes installed',
    },
    (text) => said.push(text),
    () => now,
  );
  // Other listings' news and the states around an install say nothing.
  narration.update({ state: 'notInstalled' });
  narration.update({ state: 'installing', fraction: 0 });
  for (const [at, fraction] of [
    [1000, 0.1],
    [2000, 0.3], // a quarter, within the pause after the start: not said, nor later
    [9000, 0.45],
    [10000, 0.5], // the next quarter, after the pause
    [11000, 0.6],
    [12000, 0.74],
    [13000, 0.76], // a quarter within the pause
    [20000, 0.99],
    [30000, 1], // the end of the download is no share: compiling follows
  ] as const) {
    now = at;
    narration.update({ state: 'installing', fraction });
  }
  narration.update({ state: 'installing', fraction: null });
  narration.finish();
  expect(said).toEqual(['Installing Notes', 'Installing Notes, 50%', 'Notes installed']);
  expect(QUIET_MS).toBe(5000);

  // A jump past several quarters says the last one reached, once.
  const jumped: string[] = [];
  now = 0;
  const jump = new InstallNarration(
    { started: 'start', progress: (percent) => `${percent}%`, done: 'done' },
    (text) => jumped.push(text),
    () => now,
  );
  jump.update({ state: 'installing', fraction: null });
  now = 6000;
  jump.update({ state: 'installing', fraction: 0.9 });
  now = 12000;
  jump.update({ state: 'installing', fraction: 0.95 });
  expect(jumped).toEqual(['start', '75%']);
});

test('an installed app with a newer release says Update, and updates, said as it starts and ends', async () => {
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
  const control = button(r);
  await act(async () => {
    await button(r).props.onPress();
  });
  expect(m.asked).toContain('update upd-a');
  expect(button(r)).toBe(control);
  expect(announced).toEqual(['install.updated(Notes)']);
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
