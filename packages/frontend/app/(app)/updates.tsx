import { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { AlertDialog } from '@oxy.so/bloom/alert-dialog';
import { Button } from '@oxy.so/bloom/button';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { ExpandableText } from '@oxy.so/bloom/expandable-text';
import { RiCheckboxCircleLine } from '@oxy.so/bloom/icons/RiCheckboxCircleLine';
import { RiErrorWarningLine } from '@oxy.so/bloom/icons/RiErrorWarningLine';
import { Lockup, LockupSkeleton } from '@oxy.so/bloom/lockup';
import { useTheme } from '@oxy.so/bloom/theme';
import { Text } from '@oxy.so/bloom/typography';
import { StoreInstallerError, type StoreInstaller, type StoreUpdate } from '@oxy.so/core';
import { TopLevelPage } from '@/components/page';
import { useTranslation } from '@/lib/i18n';
import { useStoreInstaller, useStoreUpdates } from '@/lib/installer';
import { formatSize } from '@/lib/format';

/**
 * Updates, as the App Store's: the account's pending updates with what is new in each, *Update*
 * for one and *Update All*, and *Check for Updates*. The state is the machine's, the same one its
 * Settings' Software Update shows (OxyOS ADR 0030, decision 16): an update applied in one is gone
 * from the other at once, and neither keeps a list of its own.
 *
 * An update that asks for more than the installed version is asked in the machine's own sheet
 * when it is applied; one applied while the app runs takes effect at its next launch.
 *
 * Only where the machine installs applications: anywhere else there is nothing to update, and the
 * route leads back to the store.
 */
export default function UpdatesScreen() {
  const installer = useStoreInstaller();
  if (!installer) return <Redirect href="/" />;
  return <Updates installer={installer} />;
}

function Updates({ installer }: { installer: StoreInstaller }) {
  const { t } = useTranslation();
  const view = useStoreUpdates();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const updates = view.status === 'ready' ? view.updates.updates : [];
  const pending = updates.filter((update) => !update.atNextLaunch);

  /** Runs `work` for `ids`, each one's button a spinner meanwhile; says what the machine did not. */
  const apply = async (ids: string[], work: () => Promise<void>) => {
    setBusy((current) => new Set([...current, ...ids]));
    try {
      await work();
    } catch (error) {
      if (!(error instanceof StoreInstallerError && error.told)) setFailed(true);
    } finally {
      setBusy((current) => new Set([...current].filter((id) => !ids.includes(id))));
    }
  };

  return (
    <TopLevelPage
      title={t('nav.updates')}
      titleAccessory={
        pending.length > 1 ? (
          <Button
            size="sm"
            appearance="solid"
            tone="accent"
            disabled={busy.size > 0}
            onPress={() =>
              void apply(
                pending.map((update) => update.id),
                () => installer.updates.applyAll(),
              )
            }
            testID="updates-update-all"
          >
            {t('updates.updateAll')}
          </Button>
        ) : undefined
      }
    >
      {view.status === 'loading' || view.status === 'none' ? (
        <View className="px-5 pt-4">
          <LockupSkeleton divider />
          <LockupSkeleton />
        </View>
      ) : view.status === 'unavailable' ? (
        <View className="px-5 py-16">
          <EmptyState
            icon={RiErrorWarningLine}
            title={t('updates.unavailable')}
            description={t('updates.unavailableHelp')}
            action={{ label: t('store.retry'), onPress: view.reload }}
          />
        </View>
      ) : (
        <>
          <CheckRow
            checking={view.updates.checking}
            lastChecked={view.updates.lastChecked}
            checkFailed={view.updates.checkFailed}
            onCheck={() => void installer.updates.check().catch(() => view.reload())}
          />
          {updates.length === 0 ? (
            <View className="px-5 py-16">
              <EmptyState
                icon={RiCheckboxCircleLine}
                title={t('updates.upToDate')}
                description={t('updates.upToDateHelp')}
              />
            </View>
          ) : (
            <View className="px-5 pt-2">
              {updates.map((update, index) => (
                <UpdateRow
                  key={update.id}
                  update={update}
                  busy={busy.has(update.id)}
                  divider={index < updates.length - 1}
                  onUpdate={() =>
                    void apply([update.id], () => installer.updates.apply([update.id]))
                  }
                />
              ))}
            </View>
          )}
        </>
      )}
      <AlertDialog
        open={failed}
        onOpenChange={(open) => {
          if (!open) setFailed(false);
        }}
        title={t('updates.failed')}
        description={t('install.failedHelp')}
        confirmLabel={t('install.ok')}
        hideCancel
      />
    </TopLevelPage>
  );
}

/** When the store was last read, and *Check for Updates*; a spinner's place while it checks. */
function CheckRow({
  checking,
  lastChecked,
  checkFailed,
  onCheck,
}: {
  checking: boolean;
  lastChecked: string | null;
  checkFailed: boolean;
  onCheck: () => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const checked = lastChecked ? new Date(lastChecked) : null;
  const line = checking
    ? t('updates.checking')
    : checkFailed
      ? t('updates.checkFailed')
      : checked && !Number.isNaN(checked.getTime())
        ? t('updates.lastChecked', {
            when: new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(checked),
          })
        : t('updates.neverChecked');
  return (
    <View className="flex-row items-center justify-between gap-4 px-5 pb-2 pt-3">
      <Text
        variant="caption-1-regular"
        style={{ color: colors.textSecondary, flexShrink: 1 }}
        testID="updates-checked"
      >
        {line}
      </Text>
      <Button
        size="sm"
        appearance="subtle"
        tone="accent"
        disabled={checking}
        onPress={onCheck}
        testID="updates-check"
      >
        {t('updates.check')}
      </Button>
    </View>
  );
}

/** One pending update: the app, its new version and size, what is new, and *Update*. */
function UpdateRow({
  update,
  busy,
  divider,
  onUpdate,
}: {
  update: StoreUpdate;
  busy: boolean;
  divider: boolean;
  onUpdate: () => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  return (
    <View className="gap-1 pb-3">
      <Lockup
        size="md"
        title={update.name}
        subtitle={t('updates.version', {
          version: update.newVersion,
          size: formatSize(update.downloadSize, locale),
        })}
        caption={
          update.needsConsent ? (
            <Text variant="caption-1-regular" style={{ color: colors.textSecondary }}>
              {t('updates.needsConsent')}
            </Text>
          ) : undefined
        }
        divider={divider && !update.releaseNotes}
        action={
          update.atNextLaunch ? (
            <Text variant="caption-1-regular" style={{ color: colors.textSecondary }}>
              {t('updates.atNextLaunch')}
            </Text>
          ) : (
            <Button
              size="sm"
              appearance="subtle"
              tone="accent"
              disabled={busy}
              accessibilityLabel={t('install.updateApp', { name: update.name })}
              onPress={onUpdate}
              testID={`update-${update.id}`}
            >
              {busy ? t('updates.updating') : t('install.update')}
            </Button>
          )
        }
        testID={`update-row-${update.id}`}
      />
      {update.releaseNotes ? (
        <ExpandableText toggle="inline" numberOfLines={3}>
          {update.releaseNotes}
        </ExpandableText>
      ) : null}
    </View>
  );
}
