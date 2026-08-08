import { createContext, useContext, useMemo, type ReactNode } from 'react';

// Minimal, dependency-free i18n. Synchronous by design — no suspense — so it is
// safe to mount at the root of the provider tree. Swap in i18next later if the
// app grows to need pluralization / interpolation / lazy locale loading.

type Messages = Record<string, string>;

const en: Messages = {
  'store.title': 'Atlas',
  'store.subtitle': 'Apps built on Oxy.',
  'store.allApps': 'All',
  'store.emptyStore': 'No apps have been published yet.',
  'store.emptyShelf': 'Nothing on this shelf yet.',
  'store.loadFailed': 'The store could not be loaded.',
  'store.retry': 'Try again',
  'app.about': 'About',
  'app.reviews': 'Reviews',
  'app.reviewCount': '{count} reviews',
  'app.noReviewsYet': 'No reviews yet',
  'app.beFirst': 'Be the first to review it.',
  'app.website': 'Website',
  'app.support': 'Support',
  'app.privacy': 'Privacy policy',
  'app.terms': 'Terms',
  'app.notFound': 'That app is not on the store.',
  'app.backToStore': 'Back to the store',
  'app.signInToReview': 'Sign in to review',
  'app.rateIt': 'Rate this app',
  'app.yourReview': 'Your review',
  'app.starLabel': '{count} stars',
  'app.withdrawReview': 'Withdraw my review',
  'app.developerReply': 'From the developer',
  'app.usesThisApp': 'uses this app',
  'app.someone': 'Someone',
};

const locales: Record<string, Messages> = { en };

interface I18nValue {
  locale: string;
  /** `t('a.b', { count: 3 })` substitutes `{count}`. No pluralization: add i18next when a language needs it. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useMemo<I18nValue>(() => {
    const full = typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : 'en-US';
    const base = full.split('-')[0];
    const messages = locales[base] ?? en;
    return {
      locale: full,
      t: (key, params) => {
        const message = messages[key] ?? key;
        if (!params) return message;
        return message.replace(/\{(\w+)\}/g, (whole, name) =>
          name in params ? String(params[name]) : whole,
        );
      },
    };
  }, []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within <LocaleProvider>');
  }
  return ctx;
}
