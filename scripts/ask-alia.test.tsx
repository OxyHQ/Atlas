import { afterEach, expect, mock, test } from 'bun:test';
import type React from 'react';
import { act, createElement, forwardRef, useImperativeHandle } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let canUsePrivateApi = true;
let presentations = 0;
let signIns = 0;
mock.module('@oxy.so/services/ui/client', () => ({
  useAuth: () => ({
    canUsePrivateApi,
    signIn: async () => {
      signIns++;
    },
  }),
}));
mock.module('@oxy.so/bloom/button', () => ({
  Button: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    createElement('FixtureButton', props),
}));
mock.module('@alia.onl/sdk/avatar', () => ({ AliaAvatarIcon: () => null }));
mock.module('@alia.onl/sdk', () => ({
  AliaChatSheet: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({
      present: () => {
        presentations++;
      },
    }));
    return createElement('FixtureSheet', props);
  }),
}));
mock.module(new URL('../packages/frontend/lib/i18n.tsx', import.meta.url).pathname, () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const { AskAlia } = await import('../packages/frontend/components/ask-alia');
let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = undefined;
  canUsePrivateApi = true;
  presentations = 0;
  signIns = 0;
});

test('passes Atlas context and opens its sheet when private API access is available', async () => {
  await act(async () => {
    renderer = create(<AskAlia screenContext="Maps" />);
  });
  if (!renderer) throw new Error('Missing renderer');
  const sheet = renderer.root.findByType('FixtureSheet' as never);
  expect(sheet.props.clientContext).toBe('alia.clientContext Maps');
  expect(sheet.props.welcomeSuggestions).toEqual([
    { id: 'discover', text: 'alia.suggestion.discover' },
    { id: 'compare', text: 'alia.suggestion.compare' },
    { id: 'publish', text: 'alia.suggestion.publish' },
  ]);
  await act(async () => renderer?.root.findByType('FixtureButton' as never).props.onPress());
  expect(presentations).toBe(1);
  expect(signIns).toBe(0);
});

test('unmounts the sheet and opens sign-in when private API access is unavailable', async () => {
  await act(async () => {
    renderer = create(<AskAlia />);
  });
  canUsePrivateApi = false;
  await act(async () => renderer?.update(<AskAlia />));
  if (!renderer) throw new Error('Missing renderer');
  expect(renderer.root.findAllByType('FixtureSheet' as never)).toHaveLength(0);
  await act(async () => renderer?.root.findByType('FixtureButton' as never).props.onPress());
  expect(presentations).toBe(0);
  expect(signIns).toBe(1);
});
