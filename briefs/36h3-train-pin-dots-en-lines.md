# Stage 36h3 — the train pin sits on its line, station dots stay 14 px, English line names in the crowding lines (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; 36h and 36h2 are committed and the suite is green (2832). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium 1440×810 @2x, new demo, after 36h; evidence `briefs/img/fid-line8-fixed-dots.jpg`, `fid-line8-fixed-dots2.jpg`)
A's 8호선 ride, 07:50–07:54, follow camera.

1. **The pin floats beside its line.**
   - The `8호선 · 나` pin sits about 40 CSS px left of the road and line it rides on.
   - The station dot for 가락시장 sits on the road. The pin, between 송파 and 가락시장, does not.
   - Cause candidates: `setTrain` projects the pin at height **90 m** (`journey-scene.js:~467` `toWorld([lon, lat], 90)`), the path is drawn at **60 m** (`:~290` `toWorld(slice[k], 60)`), and the photo road is at 0 m. At the low follow camera the height difference shows as parallax.
2. **Station dots are huge.**
   - The white dots with dark hulls (석촌 ×2, 송파, 장지, 가락시장) measure about **45–52 CSS px**. The contract is ≤ 14 px (`STATION_DOT_PX`, `updateMarkerScale` `journey-scene.js:495-513`, called every frame from `main.js:3768`).
   - Find why the clamp does not hold in this view. Suspects:
     - `camera.fov` vs the effective zoom from `setViewOffset` / `trackSimViewOffset` (`main.js:~3776`);
     - `viewHpx` from `renderer.domElement.clientHeight`;
     - another dot mesh outside `dotMesh` / `dotHull`.
3. **English crowding line splits a line name.**
   - It reads `Crowding 70% on Line 9 · Suin · Bundang Line · Gyeonggang Line is assumed`. The page translator splits on `·`, so `수인·분당선` becomes two lines.
   - Build the English names in code (`evidence.js` English branch, 36h2), from one small map next to the existing English part labels:
     - 1호선 … 9호선 → `Line 1` … `Line 9`
     - 신분당선 → `Shinbundang Line`
     - 수인·분당선 → `Suin-Bundang Line`
     - 경강선 → `Gyeonggang Line`
     - unknown → unchanged
   - Join with `, `. Expected: `Crowding 70% on Line 9, Suin-Bundang Line, Gyeonggang Line is assumed (not measured)` and `Crowding 100% on Line 8 is measured (Seoul Metro)`.
   - If that panel line is not already excluded from the page translator, mark it `data-no-i18n` the way the 29L2 commute line is.

## Change
1. **One height.** The pin, the drawn path and the dots share one height constant. Pick a height that keeps the regional cruise look and puts the pin on its line in the follow view, e.g. the same height for all three, or height chosen by camera distance. The pin projected on screen must lie on the projected path, within 4 px, at any camera.
2. **Dots ≤ 14 px.** Fix the clamp so every visible station dot is ≤ 14 CSS px tall (hull included: ≤ 14 × 1.25) in the follow view and the regional cruise.
3. **English line names.** As above.

## Test — new `web/tests/train-pin-dots-36h3.test.js`
- **Pin on line:**
  - a perspective camera at the follow pose (low, oblique, 500 m away) and the real A ride;
  - the pin's projected point (use the same function `setTrain` uses, exported if needed) is within 4 px of the projected drawn path at elapsed 8;
  - the same at a regional pose (3 km up).
- **Dots:**
  - `markerScaleFor` × `DOT_DIAM` projected at the follow pose ≤ 14 px;
  - plus whatever the root cause was, e.g. with a view offset set, the effective px still ≤ 14.
- **English:** `commuteLines(run, …, "en")` on the real A ride (skip if the build is missing) gives the two expected lines exactly.
- **Keep green:** every test that mentions `setTrain`, `updateMarkerScale`, `markerScaleFor`, `STATION_DOT_PX`, `TRAIN_MARKER_PX`, `commuteLines`, or `name-crowding-36h2`.

Run only:
```
cd web && node --test tests/train-pin-dots-36h3.test.js $(grep -lE "setTrain|updateMarkerScale|markerScaleFor|STATION_DOT_PX|TRAIN_MARKER_PX|commuteLines" tests/*.test.js | tr '\n' ' ') tests/name-crowding-36h2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`.

## Final message
Changed files, one line each. The dot root cause, in one sentence. Nothing else.
