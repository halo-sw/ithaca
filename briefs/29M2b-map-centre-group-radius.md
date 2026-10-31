# Stage 29M2b — Follow-up: the fit uses the real stage size and centres; one neighbourhood = one card; nothing touches the edge (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Orchestrator captures after 29M2 (2026-11-01). Correction to the 29M2 brief: at 1440×900 the desktop map stage is about **889 × 810 css px** (not 640×585).
1. **Seoul, English desktop:** the six pins + `Work · Gangnam` sit in the left ~40 % of the stage (their union spans css x ≈ 10–360 of 889); the right half is empty map. The union centre is ~240 px left of the free-area centre. US desktop is roughly centred, so suspect the Seoul path: check that `W`/`H` given to `layoutChatStage` / `fitMapView` are the measured stage size at fit time (not a first-render / SSR fallback), and that the 29M2 refit pass re-centres on the union of pins + workplace (boxes may extend the union, but the *centre* follows pins + workplace).
2. **US (six homes within ~250 m):** the card groups only `4 · 5 · 6` (`3 homes`); `1` and `2`, a few metres away, keep their own fanned tags stacked under the card. One neighbourhood should be one card.
3. **US phone:** the `3 homes` card's left border touches the stage edge (x ≈ 2 px).
4. **Korean phone legend** wraps inside an item: `… ■ 회사 · —` / `지하철`.

## Changes
1. Fit with the measured stage size (ResizeObserver / the existing measure); if the measure arrives after the first fit, refit. Centre the union of pins + workplace in the free area.
2. Grouping: build groups from **anchor distance** at the fitted zoom — pins whose anchors are within 72 px of another group member (transitive) form one group; ≥ 3 members → one card (rows in list order, same row buttons as 29M2). Two-member groups keep fanned tags.
3. Every tag/card/workplace pill keeps ≥ 8 px from each stage edge.
4. Legend items never break inside (`white-space: nowrap` per item; the legend wraps only between items).

## Tests — extend `web/tests/map-frame-29M2.test.js`
- Six US-like homes within 250 m + workplace 2 km NE at 889×810 and 390×600: exactly one card with six rows, no single tags.
- A Seoul-like set (six homes spread over ~3 km, workplace at the west edge of the set) at 889×810: union centre of pins + workplace within 12 % of the free-area centre horizontally and vertically.
- All boxes ≥ 8 px inside the stage.
- SSR legend: each legend item is one element with `white-space: nowrap` (or a class that sets it in `ui.css`).

Run only:
```
cd web && node --test tests/map-frame-29M2.test.js tests/map-stations-29L3.test.js tests/walk-19g.test.js tests/pins-commute-29k2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
3D scene, consult/verify, `briefs/`.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.
