// biome-ignore-all lint/style/noNonNullAssertion: Each renderer is created before use.
import { afterEach, expect, mock, test } from 'bun:test';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  setStoreInstaller,
  type StoreInstaller,
  type StoreUpdate,
  type StoreUpdates,
} from '@oxy.so/core';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** What the screen reader was told, in order. */
const announced: string[] = [];
mock.module('react-native', () => ({
  View: 'view',
  AccessibilityInfo: { announceForAccessibility: (text: string) => announced.push(text) },
}));
mock.module('expo-router', () => ({ Redirect: 'redirect' }));
mock.module('@oxy.so/bloom/alert-dialog', () => ({ AlertDialog: 'alert-dialog' }));
mock.module('@oxy.so/bloom/button', () => ({ Button: 'button' }));
mock.module('@oxy.so/bloom/empty-state', () => ({ EmptyState: 'empty-state' }));
mock.module('@oxy.so/bloom/expandable-text', () => ({ ExpandableText: 'expandable-text' }));
mock.module('@oxy.so/bloom/icons/RiCheckboxCircleLine', () => ({ RiCheckboxCircleLine: 'icon' }));
mock.module('@oxy.so/bloom/icons/RiErrorWarningLine', () => ({ RiErrorWarningLine: 'icon' }));
// The lockup draws its action, as Bloom's does.
mock.module('@oxy.so/bloom/lockup', () => ({
  Lockup: ({ action }: { action: ReactNode }) => action,
  LockupSkeleton: 'lockup-skeleton',
}));
mock.module('@oxy.so/bloom/theme', () => ({
  useTheme: () => ({ colors: { textSecondary: 'grey' } }),
}));
mock.module('@oxy.so/bloom/typography', () => ({ Text: 'text' }));
mock.module(resolve('packages/frontend/components/page.tsx'), () => ({
  TopLevelPage: ({
    titleAccessory,
    children,
  }: {
    titleAccessory: ReactNode;
    children: ReactNode;
  }) => (
    <page-view>
      {titleAccessory}
      {children}
    </page-view>
  ),
}));
mock.module(resolve('packages/frontend/lib/i18n.tsx'), () => ({
  useTranslation: () => ({
    locale: 'en-US',
    t: (key: string, params?: Record<string, string | number>) =>
      params?.name ? `${key}(${params.name})` : params?.count ? `${key}(${params.count})` : key,
  }),
}));

const { default: UpdatesScreen } = await import('../packages/frontend/app/(app)/updates');

const inbox: StoreUpdate = {
  id: 'so.oxy.inbox',
  name: 'Inbox',
  version: '0.1.0',
  newVersion: '0.2.0',
  downloadSize: 0,
  releaseNotes: null,
  needsConsent: false,
  atNextLaunch: false,
};

/** A machine with `updates` pending; applying one is held until `finish`. */
function machine(updates: StoreUpdate[]) {
  let state: StoreUpdates = { updates, checking: false, lastChecked: null, checkFailed: false };
  const listeners = new Set<(updates: StoreUpdates) => void>();
  let finish: () => void = () => {};
  const tell = (next: StoreUpdate[]) => {
    state = { ...state, updates: next };
    for (const listener of listeners) listener(state);
  };
  const installer = {
    status: async () => ({}),
    install: async () => 'installed',
    update: async () => 'updated',
    uninstall: async () => 'removed',
    open: async () => {},
    subscribe: () => () => {},
    updates: {
      current: () => state,
      read: async () => state,
      check: async () => state,
      apply: () =>
        new Promise<void>((done) => {
          finish = done;
        }),
      applyAll: async () => {},
      subscribe: (listener: (updates: StoreUpdates) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  } satisfies StoreInstaller;
  return { installer, tell, finish: () => finish() };
}

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  announced.length = 0;
  act(() => renderer?.unmount());
  renderer = null;
  setStoreInstaller(null);
});

const rowButton = (r: ReactTestRenderer) => r.root.findByProps({ testID: 'update-so.oxy.inbox' });

test('an update applied keeps its row and its control, said as it starts and as it ends', async () => {
  const m = machine([inbox]);
  setStoreInstaller(m.installer);
  await act(async () => {
    renderer = create(<UpdatesScreen />);
  });
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 0));
  });
  const r = renderer!;
  const control = rowButton(r);
  expect(control.props.accessibilityLabel).toBe('install.updateApp(Inbox)');

  await act(async () => {
    control.props.onPress();
  });
  expect(announced).toEqual(['install.updating(Inbox)']);
  expect(rowButton(r)).toBe(control);
  expect(rowButton(r).props.accessibilityLabel).toBe('install.updating(Inbox)');
  // Enabled, so that it keeps the focus, and a press asks nothing.
  expect(rowButton(r).props.disabled).toBeUndefined();
  expect(rowButton(r).props.onPress).toBeUndefined();

  // The machine's list drops it before the update's answer: the row stays, the same control.
  await act(async () => m.tell([]));
  expect(rowButton(r)).toBe(control);
  await act(async () => {
    m.finish();
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(rowButton(r)).toBe(control);
  expect(rowButton(r).props.accessibilityLabel).toBe('install.updated(Inbox)');
  expect(rowButton(r).props.children).toBe('updates.updated');
  expect(rowButton(r).props.onPress).toBeUndefined();
  expect(announced).toEqual(['install.updating(Inbox)', 'install.updated(Inbox)']);
});

test('Check for Updates says what it found', async () => {
  const m = machine([inbox]);
  setStoreInstaller(m.installer);
  await act(async () => {
    renderer = create(<UpdatesScreen />);
  });
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 0));
  });
  await act(async () => {
    await renderer!.root.findByProps({ testID: 'updates-check' }).props.onPress();
  });
  expect(announced).toEqual(['updates.found(1)']);
});
