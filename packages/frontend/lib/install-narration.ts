import { AccessibilityInfo } from 'react-native';
import type { StoreInstallState } from '@oxy.so/core';

/**
 * What a screen reader is told of an install or an update the person asked for, wherever their
 * focus is: as it starts, now and then while it runs, and as it ends.
 *
 * Its action keeps its place and the person's focus through *Get*, the ring and *Open*, but a
 * control changing in place is not said by a screen reader (VoiceOver says what is focused, not
 * what it turns into), and the person may have moved on to another listing or another page while
 * the machine works. So the store says it, as the system says a download it was asked for:
 *
 * - **As it starts**, once the machine says it is under way (after its sheet was answered, never
 *   while it asks): "Installing Inbox", "Updating Inbox"; not when the control the person is on
 *   says it already (the focus coming back to it from the machine's sheet, by its new name).
 * - **Now and then while it runs**: each quarter of the download it reaches (25, 50, 75 %), once,
 *   and only when nothing was said of it in the last {@link QUIET_MS} ms. Every step of the
 *   machine's progress would be a running commentary over whatever the person is reading (NVDA
 *   says a focused progress bar every tenth and VoiceOver not at all); a quarter is news, and the
 *   pause keeps a fast install to its start and its end, so that a share said a moment before
 *   the end never cuts off the one before it or is cut off by the next. The end is never said as
 *   a share: what follows the download (compiling it on the machine) has none.
 * - **As it ends**: "Inbox installed", "Inbox updated". A person who declined in the machine's
 *   sheet is told nothing (they answered it); a failure is said by the alert that says it, or
 *   was said by the machine.
 */
export interface InstallWords {
  /** Null when what the person is focused on already says it. */
  started: string | null;
  /** How far along, for a quarter reached: 25, 50 or 75. */
  progress: (percent: number) => string;
  done: string;
}

/** The least time between two things said of one install. */
export const QUIET_MS = 5000;

/** An announcement, as the platform's screen reader says it. */
export function announce(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}

/** One install or update, told as it goes. */
export class InstallNarration {
  private started = false;
  private quarter = 0;
  private saidAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly words: InstallWords,
    private readonly say: (text: string) => void = announce,
    private readonly now: () => number = Date.now,
  ) {}

  /** The machine said where the listing stands. */
  update(state: StoreInstallState | { state: 'unknown' }): void {
    if (state.state !== 'installing') return;
    const quarter = state.fraction === null ? 0 : Math.floor(state.fraction * 4);
    if (!this.started) {
      this.started = true;
      this.quarter = quarter;
      // The pause runs from the start, said here or by the control.
      this.saidAt = this.now();
      if (this.words.started !== null) this.say(this.words.started);
      return;
    }
    if (quarter <= this.quarter || quarter >= 4) return;
    // Reached, said or not: a quarter passed in a pause is not said late.
    this.quarter = quarter;
    if (this.now() - this.saidAt < QUIET_MS) return;
    this.speak(this.words.progress(quarter * 25));
  }

  /** It ended as the person asked: installed, or updated. */
  finish(): void {
    this.speak(this.words.done);
  }

  private speak(text: string): void {
    this.saidAt = this.now();
    this.say(text);
  }
}
