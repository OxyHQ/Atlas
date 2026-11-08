# Atlas short-page panel paint baseline

Current main `fc3b821`, published Bloom 17.19.3, preset 6.5.0. Captured with synthetic anonymous one-result catalogue, no production API calls; all external requests fulfilled locally or aborted. Chromium 390×844 and 1440×900, DPR1, light/dark, `/search?q=mail`. Four screenshots and report.json are the immutable pre-change baseline.

The compact content surface ends at y770; panel group reserves paddingBottom74 outside that surface up to y844. The bottom bar occupies those same 74px. Both modes expose the outer shell background there. This confirms #527 on current Atlas, with 74px rather than the original report's approximate66px. The padding owner is Bloom's AppShellPanelLayout, not Atlas.

At1440 the actual panel is1132px wide (x292–1424). Atlas explicitly requests contentMaxWidth="none" and correctly uses the available space. The separate default-width concern remains: Bloom's modular shell computes panelEnvelope from undefined preferred widths using DEFAULT_PANEL_WIDTH360 before laying out the flexible track. The fact that resolvePanelFlex grows a sole track does not remove that enclosing envelope. No claim that the default was fixed.

The page host already sets html/body/root height/min-height100% and both overflow axes visible. No consumer CSS or scroll workaround is needed for this repro. Published-package validation after the shared repair is still required; local candidate captures must go to a different output directory.
