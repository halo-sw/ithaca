# 50e — Update seven obsolete map expectations to the corrected loading contract

Muse tests only. No product changes, no git/full suite/build, max14 steps. Orchestrator full suite result: 3,773 pass, 7 fail, 3 skip. All seven failures below assert deliberately replaced behavior. Keep meaningful positive assertions and existing unrelated assertions. Never skip/remove tests or broaden until always passing.

New contract verified in actual browser: pending imagery is NOT loaded; Korean map needs its own station labels until VWorld actually loads; initial credits show OSM and switch to VWorld only on load; English/Korean imagery use uniform .9 opacity; underlay is still before detailed tiles, inside the same filter; current full-URL loaded tiles (normal OR underlay), not lifetime failure counts, determine basemapOn.

Read/edit only named test ranges (plus top imports/helper definitions if needed):
- `web/tests/map-english-29a5.test.js:1-45`: replace "opacity depends on currentLang" old source expectation with .9 consistent-language contract; assert subway/pins are not made faint if fixture supports it.
- `web/tests/map-frame-29M2.test.js:125-148,280-315`: SSR is pending, so Korean station labels SHOULD render, keeping names test exact.
- `web/tests/map-phone-31m.test.js:1-40,117-145`: SSR phone short credit should be © OpenStreetMap and full source credit also OSM, not unearned VWorld. Keep button/desktop presentation checks.
- `web/tests/map-stations-29L3.test.js:1-25,65-110`: SSR pending retains station name text AND dots/tooltips; update misleading test name.
- `web/tests/tile-fallback-33a2.test.js:1-20,85-115`: underlay now `.map` instead of filtering lifetime blacklist; preserve ordering assertion. Replace old `failCount *2` expectation with positive current load/underlay status requirement (new 50a tests cover actual helper behavior).
- `web/tests/walk-19g.test.js:100-140`: SSR pending keeps company pill AND station labels; preserve company pill and route assertions.

Run these six files only using node --test and tail -20. If two fix attempts fail, stop/report. Orchestrator will rerun full suite afterward.
