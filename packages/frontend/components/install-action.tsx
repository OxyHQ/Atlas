import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AlertDialog } from '@oxy.so/bloom/alert-dialog';
import { Button } from '@oxy.so/bloom/button';
import { SpinnerIcon } from '@oxy.so/bloom/loading';
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
    return (
      <ProgressRing
        fraction={fraction}
        size={size === 'sm' ? 28 : 32}
        label={t('install.installing', { name })}
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

/**
 * The App Store's download ring: how far an install is, or a spinner while the machine cannot
 * tell (asking the person, compiling).
 */
function ProgressRing({
  fraction,
  size,
  label,
}: {
  fraction: number | null;
  size: number;
  label: string;
}) {
  const { colors } = useTheme();
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={
        fraction === null ? undefined : { min: 0, max: 100, now: Math.round(fraction * 100) }
      }
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      testID="install-progress"
    >
      {fraction === null ? (
        <SpinnerIcon size={size} color={colors.primary} />
      ) : (
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      )}
    </View>
  );
}
