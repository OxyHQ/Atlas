# Atlas — the Oxy App Store

Expo / React Native frontend for the Oxy app store, at **atlas.oxy.so**. Generated
with `create-oxy-app --no-backend`.

## Atlas has no backend, and that is the point

The store lives in **oxy-api** (`OxyHQServices/packages/api`): `app_listings`,
`app_reviews`, `app_categories`, and the routes over them. Atlas reads it through
`@oxyhq/core`'s store mixin and writes reviews the same way. There is no server
here to deploy, no database, and no second copy of any store rule.

Where each surface lives:

| | |
|--|--|
| The catalogue, reviews, moderation | oxy-api (`/store`, `/applications/:appId/listing`) |
| The client for all of it | `@oxyhq/core` — `OxyServices.store.ts` |
| A publisher editing their page | Oxy Console → Apps → Store |
| The storefront people browse | **here** |
| oxy.so's own apps page | the website, which is a different product reading the same API |

Add a store capability in oxy-api and the mixin, never here.

## The store is public

Atlas has **no `(auth)`↔`(app)` swap** — the scaffold's is deliberately removed.
Every read the storefront makes is a public endpoint, and gating the catalogue
behind a login would hide it from exactly the people it exists to reach. Signing
in is needed only to write a review, and it is `useAuth().signIn()` — the SDK's
in-app dialog, opened on demand, never a navigation to a login screen.

So there is no cold-boot gate: the store renders while the session is still
resolving. Do not reintroduce one.

## Things the API decides, not this app

- **A rating is computed** from the visible reviews on every read. `average` is
  `null` when nobody has reviewed an app — never `0` — so an unreviewed app shows
  no rating at all rather than a zero-star one.
- **`authorUsesApp`** is read from the reviewer's grant at request time. It is
  `false` for a first-party app nobody consents to, so render its absence as
  nothing rather than as a demotion.
- **Icons, names and legal links come from the application**, not the listing.
  Pass the bare file id to Bloom's `<Avatar source>` with a `variant`; the
  registered `ImageResolver` builds the URL. Never construct one.

## Package manager

Always use **bun** (never npm/yarn). After changing any `package.json`, run `bun install` and commit `bun.lock` in the same commit.

## Architecture

```
packages/
  frontend/       @atlas/frontend       Expo Router · NativeWind · Bloom · @oxyhq/services
  shared-types/   @atlas/shared-types   Shared TypeScript types (CJS)
```

## Commands

```bash
bun install
bun run dev:frontend        # Expo dev server
bun run build:frontend      # expo export --platform web
```

## Oxy SDK conventions (do not deviate)

- **One provider:** `OxyProvider` from `@oxyhq/services` (web + native) with the registered `clientId` (`EXPO_PUBLIC_OXY_CLIENT_ID`). Interactive sign-in is the in-app `OxyAccountDialog` — never redirect to an IdP.
- **Config:** all Expo config comes from `@oxyhq/app-preset` — the app plugin (`['@oxyhq/app-preset', {}]`), `createOxyMetroConfig`, the shared Babel/ESLint configs, `base.css`, and the tsconfig bases. Do not copy-paste that config back into the app; update the preset instead.
- **Theming:** NativeWind className-based only, via `BloomThemeProvider`. Never hardcode brand colors.
- **Session gating:** gate private API calls on `useAuth().canUsePrivateApi`. Atlas has no `(auth)` group — see above — so there is no group swap to be the authority for.
