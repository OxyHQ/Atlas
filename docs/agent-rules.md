# Atlas rules in depth

The rules `AGENTS.md` states in one line each, with the reasoning and detail.

## Atlas has no backend

The store lives in oxy-api (`packages/api` in the oxy repo): `app_listings`, `app_reviews`,
`app_categories`, and the routes over them. Atlas reads it through `@oxy.so/core`'s `oxy.store`
namespace and writes reviews the same way. There is no server here to deploy, no database, and no
second copy of any store rule.

| Surface | Where it lives |
|--|--|
| The catalogue, reviews, moderation | oxy-api (`/store`, `/applications/:appId/listing`) |
| The client for all of it | `@oxy.so/core`, `oxy.store` (`src/api/store.ts`) |
| A publisher editing their page | Oxy Console, Apps, Store |
| The storefront people browse | this repo |
| oxy.so's own apps page | the website, a different product reading the same API |

Add a store capability in oxy-api and the `oxy.store` namespace, never here.

## The store is public

Atlas has no `(auth)`/`(app)` swap; the scaffold's is deliberately removed. Every read the
storefront makes is a public endpoint, and gating the catalogue behind a login would hide it from
the people it exists to reach. Signing in is needed only to write a review, and it is
`useAuth().signIn()`, the SDK's in-app dialog opened on demand, never a navigation to a login
screen. There is no cold-boot gate: the store renders while the session is still resolving. Do not
reintroduce one. Gate private API calls on `useAuth().canUsePrivateApi`.

## Things the API decides

- A rating is computed from the visible reviews on every read. `average` is `null` when nobody has
  reviewed an app, never `0`, so an unreviewed app shows no rating rather than a zero-star one.
- `authorUsesApp` is read from the reviewer's grant at request time. It is `false` for a
  first-party app nobody consents to, so render its absence as nothing rather than as a demotion.
- Icons, names and legal links come from the application, not the listing. Pass the bare file id to
  Bloom's `<Avatar source>` with a `variant`; the registered `ImageResolver` builds the URL. Never
  construct one.

## Installing is the machine's

Where the machine installs applications (OxyOS), its runtime registers an installer in
`@oxy.so/core` (`getStoreInstaller()`, beside `oxy.store`). Get, the progress ring, Open, Update,
"Not available for this computer" and the Updates page go through it (`lib/installer.ts`,
`components/install-action.tsx`), by a listing's slug; the machine asks the person in its own sheet.

- Never import anything of OxyOS's, never ask which platform this is, and never draw a confirmation
  of your own.
- An action is one control from Get to Open and from Update to done, never unmounted under the
  person's focus; its start, sparse progress and end are announced (`lib/install-narration.ts`),
  never each step of it.
- With no installer (web, iOS, Android) every action falls back to what the store shows there, so
  the web is unchanged.

## Releases

`android-release.yml` (oxy's reusable workflow, on `seldon`) releases the signed AAB and APK as
`android-v<version>` when `packages/frontend` `version` has none yet. Every other push to main ships
as an OTA update (`publish-update.yml`, Oxy Updates channel `production`, trusted publishing).
`version` is the OTA runtime and the derived build number: bump it only for a native change. Build
env is `eas.json` `production.env`.

## Oxy SDK conventions

- Import from `@oxy.so/services/ui/client`, never the root `@oxy.so/services` barrel: the root
  registers every account screen at import, which puts them all in the web first-paint bundle. The
  lean entry has `OxyProvider`, `useOxy`, `useAuth`, `ProfileButton`; the provider loads the screens
  as their own chunk.
- One provider: `OxyProvider` (web and native) with the registered `clientId`
  (`EXPO_PUBLIC_OXY_CLIENT_ID`). Interactive sign-in is the in-app `OxyAccountDialog`, never a
  redirect to an IdP.
- Config: all Expo config comes from `@oxy.so/app-preset` (the app plugin
  `['@oxy.so/app-preset', {}]`, `createOxyMetroConfig`, the shared Babel/ESLint configs, `base.css`,
  the tsconfig bases). Do not copy that config into the app; update the preset.
- Theming: NativeWind className-based only, via `BloomThemeProvider`. Never hardcode brand colors.

## Lint split

Biome (root `biome.json`) formats and lints everything. `packages/frontend/eslint.config.js` keeps
only the preset rules Biome lacks (`expo/*` env-var checks, React Compiler `react-hooks/*`); add a
lint rule to Biome, not there. CI runs `bunx biome ci .` and `expo lint` (`lint.yml`).
