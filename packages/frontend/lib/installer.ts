import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getStoreInstaller,
  StoreInstallerError,
  type StoreInstaller,
  type StoreInstallState,
  type StoreUpdates,
} from '@oxy.so/core';

/**
 * Installing, opening and updating, through the machine's installer: `@oxy.so/core`'s seam beside
 * `oxy.store`, which a runtime that installs applications registers before Atlas's code runs
 * (OxyOS does, for Atlas alone). Atlas never asks which platform it is on: it asks whether there
 * is an installer. Where there is none — the web, iOS, Android — every hook here says so and the
 * store looks and acts as it always has.
 *
 * The installer is the store's hands, never its judge. Atlas hands it a listing's slug; the
 * machine resolves it from the store's signed metadata, asks the person in a sheet of its own
 * that Atlas cannot draw or press, and does the work. Atlas learns the outcome and nothing of the
 * sheet. When the machine already told the person why something failed (`told`), Atlas says
 * nothing more.
 */

/** The machine's installer, or null where nothing installs applications. Fixed for the run. */
export function useStoreInstaller(): StoreInstaller | null {
  return getStoreInstaller();
}

/**
 * Where a listing stands, for its action. `unknown` until the machine has said, and when it
 * cannot say (its install service is not running): the action is then *Get*, and pressing it
 * lets the machine say why it cannot.
 */
export type InstallState = StoreInstallState | { state: 'unknown' };

const UNKNOWN: InstallState = { state: 'unknown' };

/**
 * Every listing's state, kept once for the whole app so a shelf of thirty lockups asks the
 * machine once, and a page and the shelf under it never disagree. Listings asked for in the same
 * turn are asked in one `status`; the installer's own news (progress, an install done) lands here
 * as it comes.
 */
class InstallStates {
  private readonly states = new Map<string, InstallState>();
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Set<string>();
  private scheduled = false;
  private unsubscribe: (() => void) | null = null;

  constructor(readonly installer: StoreInstaller) {}

  get(slug: string): InstallState {
    return this.states.get(slug) ?? UNKNOWN;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.unsubscribe ??= this.installer.subscribe((slug, state) => this.set(slug, state));
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Asks the machine where `slugs` stand, once each per turn. */
  want(slugs: readonly string[]): void {
    for (const slug of slugs) this.pending.add(slug);
    if (this.scheduled || this.pending.size === 0) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const asked = [...this.pending];
      this.pending.clear();
      this.installer.status(asked).then(
        (states) => {
          for (const slug of asked) this.set(slug, states[slug] ?? UNKNOWN);
        },
        // The machine cannot say: the listings stay unknown, and *Get* lets it say why.
        () => {
          for (const slug of asked) this.set(slug, UNKNOWN);
        },
      );
    });
  }

  set(slug: string, state: InstallState): void {
    const before = this.states.get(slug);
    if (before && JSON.stringify(before) === JSON.stringify(state)) return;
    this.states.set(slug, state);
    for (const listener of this.listeners) listener();
  }
}

let shared: InstallStates | null = null;

/** The states kept for `installer`: one installer for a run, so one set of states. */
function installStates(installer: StoreInstaller): InstallStates {
  if (shared?.installer !== installer) shared = new InstallStates(installer);
  return shared;
}

const noop = () => () => {};

/** Where `slug` stands on this machine; null where nothing installs applications. */
export function useInstallState(slug: string): InstallState | null {
  const installer = useStoreInstaller();
  const states = installer ? installStates(installer) : null;
  const subscribe = useCallback(
    (listener: () => void) => (states ? states.subscribe(listener) : noop()),
    [states],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => (states ? states.get(slug) : null),
    () => null,
  );
  useEffect(() => {
    states?.want([slug]);
  }, [states, slug]);
  return state;
}

/** What pressing a listing's action did that the machine did not already tell the person. */
export type InstallFailure = { action: 'install' | 'update' | 'open'; error: unknown };

/**
 * The action for a listing's state, run through the installer. Resolves with the failure Atlas
 * must say itself, or null when there is nothing to say (done, declined in the machine's sheet,
 * or told by the machine).
 */
export async function runInstallAction(
  installer: StoreInstaller,
  slug: string,
  state: InstallState,
): Promise<InstallFailure | null> {
  const action =
    state.state === 'installed' ? 'open' : state.state === 'updateAvailable' ? 'update' : 'install';
  try {
    if (action === 'open') await installer.open(slug);
    else if (action === 'update') await installer.update(slug);
    else await installer.install(slug);
    return null;
  } catch (error) {
    if (error instanceof StoreInstallerError && error.told) return null;
    return { action, error };
  } finally {
    // Whatever happened, where it stands now.
    installStates(installer).want([slug]);
  }
}

/** The account's updates, as the machine keeps them: one state, which Settings shows too. */
export type UpdatesView =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; updates: StoreUpdates };

/** The account's updates, read once and followed; `none` where nothing installs applications. */
export function useStoreUpdates(): UpdatesView & { reload: () => void } {
  const installer = useStoreInstaller();
  const store = useMemo(() => (installer ? createUpdatesStore(installer) : null), [installer]);
  const view = useSyncExternalStore(
    store?.subscribe ?? noop,
    () => store?.get() ?? NONE,
    () => NONE,
  );
  useEffect(() => store?.read(), [store]);
  return { ...view, reload: () => store?.read() };
}

const NONE: UpdatesView = { status: 'none' };

function createUpdatesStore(installer: StoreInstaller) {
  let view: UpdatesView = { status: 'loading' };
  const listeners = new Set<() => void>();
  const set = (next: UpdatesView) => {
    view = next;
    for (const listener of listeners) listener();
  };
  let following: (() => void) | null = null;
  return {
    get: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      following ??= installer.updates.subscribe((updates) => set({ status: 'ready', updates }));
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          following?.();
          following = null;
        }
      };
    },
    read() {
      installer.updates.read().then(
        (updates) => set({ status: 'ready', updates }),
        () => set({ status: 'unavailable' }),
      );
    },
  };
}
