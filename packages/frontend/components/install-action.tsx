import { useState, type ReactNode } from 'react';
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
 * draws no confirmation of its own.
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

  if (state.state === 'installing' || busy) {
    const fraction = state.state === 'installing' ? state.fraction : null;
    // Bloom's download ring: turning while the machine cannot tell how far it is (asking the
    // person, compiling), its share once it can. No stop square: the machine's installer
    // cannot be stopped from the store.
    return (
      <MeterRing
        value={fraction ?? 0}
        indeterminate={fraction === null}
        size={size === 'sm' ? 28 : 32}
        thickness={2.5}
        accessibilityLabel={t('install.installing', { name })}
        testID="install-progress"
      />
    );
  }

  const label =
    state.state === 'installed'
      ? t('install.open')
      : state.state === 'updateAvailable'
        ? t('install.update')
        : t('install.get');
  const accessibilityLabel =
    state.state === 'installed'
      ? t('install.openApp', { name })
      : state.state === 'updateAvailable'
        ? t('install.updateApp', { name })
        : t('install.getApp', { name });

  return (
    <>
      <Button
        size={size}
        appearance={size === 'sm' ? 'subtle' : 'solid'}
        tone="accent"
        accessibilityLabel={accessibilityLabel}
        testID={`install-${slug}`}
        onPress={async () => {
          setBusy(true);
          const failed = await runInstallAction(installer, slug, state);
          setBusy(false);
          setFailure(failed);
        }}
      >
        {label}
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
