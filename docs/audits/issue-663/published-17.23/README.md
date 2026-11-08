# Published Atlas adoption checkpoint

The app now resolves registry Bloom 17.23.0 and app-preset 6.6.0 through the normal Bun installation. `registry-byte-check.json` compares all 27,834 Bloom and 38 preset files against the verified registry tarballs; no source mirror or patched package is present. The package and lock changes accompany this checkpoint. Services remains 14.14.0 until the reviewed 14.15.3 adapter is published.

`global.css` adopts the preset's explicit `css/document-scroll.css` entry instead of the local `overflow: visible` rule. The full-height html/body/root chain is preserved. Atlas already explicitly uses document panel flow on web; its native bounded flow is unchanged. This is consumer adoption of the shared opt-in, not an alternative CSS fix.

## Runtime evidence

Chromium, synthetic anonymous `/search?q=mail`, DPR 1, light/dark, widths 320/390/1440. The original 17.19.3 baseline remains unchanged in the parent directory. `short` has one result; `long` has fifty. Twelve screenshots plus backing captures and reports show:

- No horizontal document overflow at any tested width.
- Real wheel input moves the long document from 0 to 650 before the end-of-page capture. Programmatic end positioning is separately recorded and is not counted as wheel acceptance.
- At 390, pixels across the former y770 material discontinuity match; the final result clears the persistent bottom bar. The 320 screenshot also preserves accessible visible controls and bottom navigation.
- The real account dialog holds document position 839 with body overflow hidden, blocks an outside wheel, and restores 839 on explicit Close. A subsequent wheel moves to 439 in both themes. The preset does not defeat the dialog's inline lock.
- Account policy deliberately prevents root Escape/backdrop dismissal (`SurfaceScreen.handleSystemBack`, `dismissOnBackdrop: false`); Escape leaves the dialog open. The harness follows this existing contract rather than treating it as a CSS regression.
- Zero page errors and unexpected requests. Auth bridge and session-create requests opened by the real dialog are explicitly aborted and recorded in `blockedAuth`; authentication itself is not under test and no production requests are sent.

Reproduce from repository root with Metro on 8131, configured with `EXPO_PUBLIC_API_URL=https://atlas-fixture.invalid` and `EXPO_PUBLIC_OXY_CLIENT_ID=fixture-atlas`:

```sh
PLAYWRIGHT_PACKAGE_JSON=/path/to/playwright-host/package.json VERIFY_PUBLISHED=1 \
  BASELINE_OUTPUT=/tmp/atlas-short node scripts/capture-shell-baseline.mjs
PLAYWRIGHT_PACKAGE_JSON=/path/to/playwright-host/package.json VERIFY_PUBLISHED=1 \
  FIXTURE_COUNT=50 BASELINE_OUTPUT=/tmp/atlas-long node scripts/capture-shell-baseline.mjs
```

## Gates and pending work

Lint and all 36 store tests pass. The real frontend typecheck fails with the same two TS2339 errors in published Services 14.14.0's `useSurfaceHeader`: it assumes every Bloom header action has `accessibilityLabel`. Oxy PR 2232 corrects this shared adapter and prepares Services 14.15.3; this checkpoint must remain unmerged until that release is installed and typecheck/build/runtime are verified against published dependencies. No casts, package patches or local type aliases hide the incompatibility.

This is a browser adoption checkpoint, not physical Android/iPhone acceptance, full issue 663 completion, or acceptance of the separate default panel-width contract.
