# Stage 38c5 — map walk: controls never pushed out of the panel, clear 3D/2D/back labels, station pills never cover the home pin (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (live run, captures at 1440×810 and 390×844)
1. **The bottom of the map walk is cut off** on both sizes. The `전체`/`따라가기` row is half visible and the activity line is not visible at all.
   - Cause: `web/src/ui/ui.css:886` gives `.ui-mapwalk { height: 100%; }`. It sits in `.ui-chat-scene` (a flex column, `:874-875`) below `.ui-chat-scene-head`, so it is the full panel height plus the head's height and overflows by exactly the head.
2. **Two buttons both mean "map".** The header shows `3D | 지도` (the toggle) and then `지도로` (back to the homes map, `web/src/ui/chat.jsx:3805`). On an English phone `sceneActionLabelFor` shortens "To the map" to `Map` (`web/src/ui/scene-chrome.js:26-31`), so the toggle and the back button both read `Map`.
3. **The `남한산성입구` pill covers home pin B and the moving dot** at the start of the day. `placeLabels` (`web/src/mapwalk.js:354-368`) only avoids other pills; the pill rect is centred above the point with its bottom edge on the point.

## Change
1. **Layout** (`web/src/ui/ui.css:886-888`):
   - `.ui-mapwalk { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }` (no `height: 100%`);
   - `.ui-mapwalk-map { flex: 1 1 auto; min-height: 200px; min-width: 0; }`;
   - `.ui-mapwalk-foot { padding: 0 16px 12px; }`.
2. **One controls row** (`web/src/ui/mapwalk.jsx:366-393`): move the `전체`/`따라가기` buttons into the same wrapping flex row as play / slider / day nav, after the day nav, and delete the second row. At 390 px it wraps naturally to two lines (play + slider, then day nav + Fit + Follow). Keep the activity line as its own paragraph below.
3. **Labels**:
   - Toggle (`chat.jsx:3808`): `modeMap` becomes `2D` (both languages). `3D` stays.
   - Back button (`chat.jsx:3805`): `backFull` becomes `후보 지도` / `Homes map`.
   - `sceneActionLabelFor` (`scene-chrome.js:26-31`): on an English phone `Homes map` → `Homes`. Drop the `To the map` branch.
4. **Pills avoid pins** (`mapwalk.js` `placeLabels`, `mapwalk.jsx:273-288`):
   - `placeLabels(items, measure, obstacles = [])`, where `obstacles` is a list of rects `{x, y, w, h}` treated as already placed.
   - For each item, try three positions in order and keep the first that hits neither a placed pill nor an obstacle:
     - above, with a 6 px gap (`y: it.y - h - 6`);
     - below (`y: it.y + 6`);
     - right (`x: it.x + 10`, vertically centred).
   - Skip the pill if all three hit.
   - In `mapwalk.jsx`, pass 28×28 rects centred on each home pin, on the workplace square and on the moving dot's current position.

## Tests — extend `web/tests/mapwalk-38c.test.js`
- **`placeLabels` with an obstacle** at the point's "above" slot puts the pill below, and with obstacles above and below puts it to the right. With all three blocked it returns no pill.
- **CSS:** `ui.css` has no `height: 100%` inside the `.ui-mapwalk {` rule, and has `min-height: 0` there.
- **SSR:** `MapWalk` with a fixture renders `전체` and the day label inside the same flex row (one container holds both the range input and the `전체` button).
- **SceneFrame:** a `custom=` URL renders `3D`, `2D` and `후보 지도`, and not `지도로`. English renders `Homes map`.
- **`sceneActionLabelFor`:** `("Homes map", { phone: true, lang: "en" })` → `Homes`; `("Homes map", { phone: false, lang: "en" })` → `Homes map`.
- **Update the old pins:**
  - `web/tests/scene-panel-27c1.test.js:57` now expects `후보 지도`;
  - `web/tests/en-names-29L6.test.js:80-85` follow the new label (Korean label unchanged on phones).
- **Keep green:** web tests matching `mapwalk|SceneFrame|sceneActionLabelFor|scene-panel`.

Run only:
```
cd web && node --test tests/mapwalk-38c.test.js $(grep -lE "mapwalk|SceneFrame|sceneActionLabelFor|scene-panel" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/**`, `web/src/main.js`, `web/src/consult/**`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
