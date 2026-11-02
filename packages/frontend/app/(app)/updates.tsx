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
import { announce } from '@/lib/install-narration';

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
  // Updates applied while the page is open, each with where its row was: as the App Store keeps
  // them under Updated Recently, a row stays where it was once the machine's list drops it, its
  // action saying it is done, so the keyboard's focus and the screen reader's stay on it rather
  // than going with a row that vanished. Kept from the press, before the machine's list can drop
  // it, so that the row is never gone for a moment.
  const [kept, setKept] = useState<readonly { update: StoreUpdate; at: number }[]>([]);
  // Update All, once pressed, stays for the visit as the rows do, saying it is done.
  const [appliedAll, setAppliedAll] = useState(false);

  const updates = view.status === 'ready' ? view.updates.updates : [];
  const pending = updates.filter((update) => !update.atNextLaunch);
  const listed = (id: string) => updates.some((update) => update.id === id);
  const rows = [...updates];
  for (const { update, at } of [...kept].sort((a, b) => a.at - b.at)) {
    if (!listed(update.id)) rows.splice(Math.min(at, rows.length), 0, update);
  }

  /**
   * Runs `work` for `ids`, each one's button saying it is updating meanwhile, and says what it
   * came to (`InstallNarration`'s start and end, wherever the person's focus is): each update
   * done, or waiting for its next launch, by its name; and what failed that the machine did not
   * say, in an alert.
   */
  const apply = async (ids: string[], work: () => Promise<void>) => {
    const asked = pending.filter((update) => ids.includes(update.id));
    const others = (entry: { update: StoreUpdate }) => !ids.includes(entry.update.id);
    setKept((current) => [
      ...current.filter(others),
      ...asked.map((update) => ({ update, at: rows.indexOf(update) })),
    ]);
    setBusy((current) => new Set([...current, ...ids]));
    const [only] = asked;
    announce(
      only && asked.length === 1
        ? t('install.updating', { name: only.name })
        : t('updates.updatingCount', { count: asked.length }),
    );
    try {
      await work();
      const after = await installer.updates.read().catch(() => null);
      const still = (update: StoreUpdate) =>
        after?.updates.find((left) => left.id === update.id) ?? null;
      // Gone from the machine's list, or applied and waiting for the running copy to quit.
      const done = asked.filter((update) => !still(update) || still(update)?.atNextLaunch);
      // Those not done are the machine's list's again.
      setKept((current) => current.filter((entry) => others(entry) || done.includes(entry.update)));
      const [one] = done;
      if (one && done.length === 1) {
        announce(
          still(one)
            ? t('updates.atNextLaunchSaid', { name: one.name })
            : t('install.updated', { name: one.name }),
        );
      } else if (done.length > 1) {
        announce(t('updates.updatedCount', { count: done.length }));
      }
    } catch (error) {
      setKept((current) => current.filter(others));
      if (!(error instanceof StoreInstallerError && error.told)) setFailed(true);
    } finally {
      setBusy((current) => new Set([...current].filter((id) => !ids.includes(id))));
    }
  };

  /**
   * Reads the store, and says what it found: the list it changes may be far from the person's
   * focus, which stays on *Check for Updates*.
   */
  const check = async () => {
    try {
      const found = await installer.updates.check();
      const waiting = found.updates.filter((update) => !update.atNextLaunch).length;
      announce(
        found.checkFailed
          ? t('updates.checkFailed')
          : waiting === 0
            ? t('updates.upToDate')
            : t('updates.found', { count: waiting }),
      );
    } catch {
      view.reload();
    }
  };

  const updatingAll = busy.size > 1;
  const allDone = appliedAll && !updatingAll && pending.length < 2;

  return (
    <TopLevelPage
      title={t('nav.updates')}
      titleAccessory={
        pending.length > 1 || appliedAll ? (
          <Button
            size="sm"
            appearance={allDone ? 'plain' : 'solid'}
            tone={allDone ? 'neutral' : 'accent'}
            // Enabled while it works and once done, so that it keeps the focus; a press then asks
            // nothing.
            onPress={
              busy.size > 0 || allDone
                ? undefined
                : () => {
                    setAppliedAll(true);
                    void apply(
                      pending.map((update) => update.id),
                      () => installer.updates.applyAll(),
                    );
                  }
            }
            testID="updates-update-all"
          >
            {updatingAll
              ? t('updates.updating')
              : allDone
                ? t('updates.updated')
                : t('updates.updateAll')}
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
            onCheck={() => void check()}
          />
          {rows.length === 0 ? (
            <View className="px-5 py-16">
              <EmptyState
                icon={RiCheckboxCircleLine}
                title={t('updates.upToDate')}
                description={t('updates.upToDateHelp')}
              />
            </View>
          ) : (
            <View className="px-5 pt-2">
              {rows.map((update, index) => (
                <UpdateRow
                  key={update.id}
                  update={update}
                  busy={busy.has(update.id)}
                  done={!listed(update.id)}
                  divider={index < rows.length - 1}
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
        // Enabled while it checks, so that it keeps the focus; a press then asks nothing.
        onPress={checking ? undefined : onCheck}
        testID="updates-check"
      >
        {t('updates.check')}
      </Button>
    </View>
  );
}

/**
 * One update: the app, its new version and size, what is new, and its action. The action is one
 * control from *Update* to done, as an install's is from *Get* to *Open*: *Updating…* while the
 * machine works, *Next Launch* once applied while the app runs, *Updated* once switched; it keeps
 * the keyboard's focus and the screen reader's throughout, and a second press asks nothing.
 */
function UpdateRow({
  update,
  busy,
  done,
  divider,
  onUpdate,
}: {
  update: StoreUpdate;
  busy: boolean;
  /** Updated while the page is open: gone from the machine's list, kept here. */
  done: boolean;
  divider: boolean;
  onUpdate: () => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const waiting = done || update.atNextLaunch;
  const name = update.name;
  const [label, accessibilityLabel] = busy
    ? [t('updates.updating'), t('install.updating', { name })]
    : done
      ? [t('updates.updated'), t('install.updated', { name })]
      : update.atNextLaunch
        ? [t('updates.atNextLaunch'), t('updates.atNextLaunchSaid', { name })]
        : [t('install.update'), t('install.updateApp', { name })];
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
          update.needsConsent && !waiting ? (
            <Text variant="caption-1-regular" style={{ color: colors.textSecondary }}>
              {t('updates.needsConsent')}
            </Text>
          ) : undefined
        }
        divider={divider && !update.releaseNotes}
        action={
          <Button
            size="sm"
            appearance={waiting ? 'plain' : 'subtle'}
            tone={waiting ? 'neutral' : 'accent'}
            accessibilityLabel={accessibilityLabel}
            onPress={busy || waiting ? undefined : onUpdate}
            testID={`update-${update.id}`}
          >
            {label}
          </Button>
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
