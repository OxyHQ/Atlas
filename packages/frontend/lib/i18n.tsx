import { createContext, useContext, useMemo, type ReactNode } from 'react';

// Minimal, dependency-free i18n. Synchronous by design — no suspense — so it is
// safe to mount at the root of the provider tree. Swap in i18next later if the
// app grows to need pluralization / interpolation / lazy locale loading.

type Messages = Record<string, string>;

const en: Messages = {
  'store.title': 'Atlas',
  'store.subtitle': 'Apps built on Oxy.',
  'store.view': 'View',
  'store.emptyStore': 'No apps have been published yet.',
  'store.emptyStoreHelp':
    'Apps appear here once their developers publish them from the Oxy Console.',
  'store.viewApp': 'View {name}',
  'store.featuredLabel': '{eyebrow}: {name}',
  'discover.spotlight': 'Spotlight',
  'discover.topRated': 'Top rated',
  'discover.new': 'New on Atlas',
  'discover.newApps': 'New on Atlas',
  'discover.topRatedApps': 'Top Rated',
  'discover.browseCategories': 'Browse Categories',
  'category.appCount': '{count} apps',
  'search.results': '{count} results',
  'search.suggestion': 'Search for {query}',
  'app.openApp': 'Open {name}',
  'app.ratings': 'Ratings',
  'app.ratedFact': 'Rated {rating} out of 5, {count} reviews',
  'app.categoryFact': 'Category: {category}',
  'app.websiteFact': 'Website: {host}',
  'app.released': 'Released',
  'app.facts': 'About this app',
  'app.preview': 'Preview',
  'app.screenshotsFor': 'Screenshots for',
  'app.screenshotLabel': 'Screenshot {index} of {count}',
  'app.ratingsAndReviews': 'Ratings & Reviews',
  'app.tapToRate': 'Tap to rate:',
  'app.yourRating': 'Your rating:',
  'app.supportEmail': 'Support email',
  'app.information': 'Information',
  'app.mightAlsoLike': 'You Might Also Like',
  'platform.phone': 'Phone',
  'platform.tablet': 'Tablet',
  'platform.desktop': 'Desktop',
  'platform.web': 'Web',
  'store.loadFailed': 'The store could not be loaded.',
  'store.retry': 'Try again',
  'app.open': 'Open',
  'app.category': 'Category',
  'app.reviews': 'Reviews',
  'app.reviewCount': '{count} reviews',
  'app.noReviewsYet': 'No reviews yet',
  'app.website': 'Website',
  'app.support': 'Support',
  'app.privacy': 'Privacy policy',
  'app.terms': 'Terms',
  'app.notFound': 'That app is not on the store.',
  'app.backToStore': 'Back to the store',
  'app.signInToReview': 'Sign in to review',
  'app.rateIt': 'Rate this app',
  'app.withdrawReview': 'Withdraw my review',
  'app.developerReply': 'From the developer',
  'app.usesThisApp': 'uses this app',
  'app.someone': 'Someone',
  'alia.ask': 'Ask Alia',
  'alia.clientContext':
    'The person is using Atlas, the Oxy app store, where they browse apps built on Oxy, read their details and reviews, and review the apps they use.',
  'alia.looking.store': 'They are on the storefront, which shows the shelves: {categories}.',
  'alia.suggestion.discover': 'Which apps should I try first?',
  'alia.suggestion.compare': 'Help me pick between two apps',
  'alia.suggestion.publish': 'How do I publish my app here?',
  'nav.discover': 'Discover',
  'nav.apps': 'Apps',
  'nav.categories': 'Categories',
  'nav.search': 'Search',
  'nav.settings': 'Settings',
  'search.placeholder': 'Apps, categories and more',
  'search.discover': 'Discover',
  'search.noResults': 'No results',
  'search.noResultsHelp': 'Nothing on the store matches “{query}”.',
  'category.notFound': 'That category is not on the store.',
  'category.empty': 'Nothing here yet',
  'category.emptyHelp': 'No app has been published in this category yet.',
  'settings.title': 'Settings',
  'settings.signedOut': 'You are browsing signed out. Sign in to review an app.',
  'settings.signIn': 'Sign in',
  'settings.signOut': 'Sign out',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeHelp': 'Tap to cycle light, dark and system.',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.theme.adaptive': 'System',
  'settings.store': 'Store',
  'settings.browse': 'Browse apps',
  'settings.publishYourApp': 'Publish your app',
  'settings.publishHelp': 'Write its store page in the Oxy Console.',
  'settings.about': 'About',
  'settings.aboutFooter':
    'Atlas is the Oxy app store. The apps it lists are built by their own developers.',
  'settings.oxy': 'Oxy',
  'settings.privacy': 'Privacy policy',
  'settings.terms': 'Terms',
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
    const full =
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : 'en-US';
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
