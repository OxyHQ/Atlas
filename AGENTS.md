# Atlas

Atlas is the Oxy app store storefront (atlas.oxy.so): an Expo / React Native frontend with no
backend of its own; the catalogue and reviews live in oxy-api and are read through `oxy.store`.

## Commands

```bash
bun install                 # also builds shared-types (postinstall)
bun run dev:frontend        # Expo dev server
bun run build:frontend      # expo export --platform web
bun run lint                # biome check . + expo lint
bun run lint:fix            # biome check --write .
bun run format              # biome format --write .
bun run test:store          # store, review, install and updates tests
bun run test:worker         # edge worker tests
bun run test:ask-alia       # Ask Alia tests
bun run doctor:oxy          # Oxy dependency check
```

## Map

- `packages/frontend`: the Expo Router app (`@atlas/frontend`).
- `packages/shared-types`: shared TypeScript types (`@atlas/shared-types`).
- `scripts/`: `bun test` files and bundle-comparison tooling.
- [`docs/agent-rules.md`](docs/agent-rules.md): the rules below in depth.

## Conventions that differ from defaults

- Add store capabilities in oxy-api and `oxy.store`, never in this repo: there is no server and no
  second copy of a store rule.
- Keep the store public: no `(auth)` group and no cold-boot login gate, because a login wall hides
  the catalogue from its audience. Sign in on demand with `useAuth().signIn()` only to write a review.
- Render API-decided values as given: `average` is `null` (not `0`) with no reviews, and
  `authorUsesApp: false` renders as nothing.
- Pass bare file ids to Bloom's `<Avatar source>`; never build an icon or image URL.
- Install, Open and Update go through `getStoreInstaller()` (`packages/frontend/lib/installer.ts`); never import from
  OxyOS or draw your own confirmation.
- Import from `@oxy.so/services/ui/client`, never the root barrel, to keep account screens out of
  the web first-paint bundle.
- Style with NativeWind classes via `BloomThemeProvider`; no hardcoded brand colors.
- Take Expo config from `@oxy.so/app-preset`; update the preset rather than copying config.
- Add lint rules to Biome, not ESLint (Biome gate: `bunx biome ci .` in `lint.yml`).
- Use bun only; commit `bun.lock` with any `package.json` change.

## Boundaries

- Never edit `bun.lock` by hand or with another package manager; it is the CI lockfile gate.
- Never bump `packages/frontend` `version` for a JS-only change: it is the OTA runtime and native
  build number, so a bump triggers a native release.
- Ask first before changing `eas.json`, workflow files, or the `@oxy.so/*` overrides in
  `package.json` (the autobump workflow owns them).

## Testing

Run `bun run lint` and the `test:*` script for the area you touched. Done means lint and those
tests pass locally and CI is green.

## PR and commit rules

Branch from `main`, open a PR, and merge with the repo's flow (squash). Native-affecting changes
call out the `version` bump in the PR description.

## Secrets

Public client values come from `EXPO_PUBLIC_*` env vars (for example `EXPO_PUBLIC_OXY_CLIENT_ID`);
build env is `eas.json` `production.env`. Never print or commit credentials.

## Links

- [Atlas rules in depth](docs/agent-rules.md)
- [First-party platform](docs/first-party-platform.md)
- [Oxy engineering standards](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/standards.md)
- [Lint and format](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/lint-and-format.md)
- [npm releases](https://github.com/OxyHQ/oxy/blob/main/docs/npm-releases.md)
- [Bloom app conventions](https://github.com/OxyHQ/Bloom/blob/main/docs/app-conventions.mdx)

Owner: Nate Isern (OxyHQ). Last reviewed: 2026-11-11.
