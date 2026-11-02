import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AlertDialog } from '@oxy.so/bloom/alert-dialog';
import { Button } from '@oxy.so/bloom/button';
import { MeterRing } from '@oxy.so/bloom/stat-bar';
import { useTheme } from '@oxy.so/bloom/theme';
import { Text } from '@oxy.so/bloom/typography';
import { useTranslation } from '@/lib/i18n';
import {
  runInstallAction,
  useInstallState,
  useStoreInstaller,
  type InstallFailure,
} from '@/lib/installer';

/**
 * A listing's action where the machine installs applications, as the App Store's: *Get*, a
 * progress ring while it installs, *Open*, *Update*, or *Not available for this computer*. Every
 * press goes to the machine's installer, which asks the person in the system's own sheet; Atlas
 * draws no confirmation of its own. *Get*, the ring and *Open* are one control, which keeps the
 * keyboard's focus and the screen reader's throughout; what it comes to is said
 * (`InstallNarration`).
 *
 * Where nothing installs applications (no installer), it renders `fallback`: what the store shows
 * there (the lockup's View, the page's Open of the website).
 */
export function InstallAction({
  slug,
  name,
  size = 'md',
  fallback,
}: {
  slug: string;
  name: string;
  /** `sm` in a lockup's row, `md` at the head of an app's page. */
  size?: 'sm' | 'md';
  fallback?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const installer = useStoreInstaller();
  const state = useInstallState(slug);
  // Pressed and not yet answered: the machine's sheet may be up. One press at a time.
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<InstallFailure | null>(null);
  // What the last press asked for, so the ring of an update is named as one.
  const [wasUpdate, setWasUpdate] = useState(false);
  // The keyboard's focus is on the control (and so the screen reader's).
  const focused = useRef(false);

  if (!installer || !state) return fallback ?? null;

  if (state.state === 'unavailable') {
    // A row says it in a word; the page says it whole, where the reader looks for why.
    return size === 'sm' ? (
      (fallback ?? null)
    ) : (
      <Text
        variant="caption-1-regular"
        style={{ color: colors.textSecondary, maxWidth: 160, textAlign: 'right' }}
        testID="install-unavailable"
      >
        {t('install.notAvailable')}
      </Text>
    );
  }

  // Pressed and not yet answered (the machine's sheet may be up), or under way: the ring. Opening
  // keeps *Open* as it is: it is over before a ring could be seen.
  const working = state.state === 'installing' || (busy && state.state !== 'installed');
  const fraction = state.state === 'installing' ? state.fraction : null;
  const updating = state.state === 'updateAvailable' || (state.state === 'installing' && wasUpdate);
  // What a press would ask for: an update, or an install.
  const update = state.state === 'updateAvailable';

  const label =
    state.state === 'installed'
      ? t('install.open')
      : state.state === 'updateAvailable'
        ? t('install.update')
        : t('install.get');
  const accessibilityLabel = working
    ? t(updating ? 'install.updating' : 'install.installing', { name })
    : state.state === 'installed'
      ? t('install.openApp', { name })
      : state.state === 'updateAvailable'
        ? t('install.updateApp', { name })
        : t('install.getApp', { name });

  return (
    <>
      {/*
        One control from *Get* to *Open*, as the App Store's: the ring is drawn in the same button,
        so the keyboard's focus and the screen reader's stay on it while the machine works, and
        it is *Open* where the person left *Get*. While it works it is named for what it is doing
        ("Installing Inbox"), and nothing in the store can stop the machine: pressing it does
        nothing. Its share is not its value, which a screen reader says at every change of the
        focused control: `InstallNarration` says it now and then instead.
      */}
      <Button
        size={size}
        appearance={working ? 'plain' : size === 'sm' ? 'subtle' : 'solid'}
        tone="accent"
        accessibilityLabel={accessibilityLabel}
        testID={`install-${slug}`}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        icon={
          working ? (
            // Bloom's download ring: turning while the machine cannot tell how far it is (asking
            // the person, compiling), its share once it can. No stop square: the machine's
            // installer cannot be stopped from the store.
            <View
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <MeterRing
                value={fraction ?? 0}
                indeterminate={fraction === null}
                size={size === 'sm' ? 28 : 32}
                thickness={2.5}
                accessibilityLabel={accessibilityLabel}
                testID="install-progress"
              />
            </View>
          ) : undefined
        }
        onPress={
          busy || working
            ? undefined
            : async () => {
                setBusy(true);
                setWasUpdate(update);
                const failed = await runInstallAction(installer, slug, state, {
                  // An install always asks in the machine's sheet, which takes the focus and gives
                  // it back: the screen reader then says the control again, by its new name
                  // ("Installing Inbox, button"), and saying it as well would say it twice. An
                  // update asks nothing (or after it starts), and the person's focus may be
                  // elsewhere: said.
                  started:
                    !update && focused.current
                      ? null
                      : t(update ? 'install.updating' : 'install.installing', { name }),
                  progress: (percent) =>
                    t(update ? 'install.updatingProgress' : 'install.installingProgress', {
                      name,
                      percent,
                    }),
                  done: t(update ? 'install.updated' : 'install.installed', { name }),
                });
                setBusy(false);
                setFailure(failed);
              }
        }
      >
        {working ? undefined : label}
      </Button>
      <AlertDialog
        open={failure !== null}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
        title={t(`install.failed.${failure?.action ?? 'install'}`, { name })}
        description={t('install.failedHelp')}
        confirmLabel={t('install.ok')}
        hideCancel
      />
    </>
  );
}
