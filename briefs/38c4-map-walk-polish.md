# Stage 38c4 — map walk polish: the panel title never clips on phones, the map fills the panel, real buttons, gutters, station labels, pins inside the fit (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (captures at 1440×810 and 390×844 @3x, Korean)
1. **Phone, 3D mode: the title clips.** The header shows `5일차 08:` and then the toggle. `.ui-chat-scene-title` is `white-space: nowrap` (`web/src/ui/ui.css:880`), and the header row (`:876`) also holds `3D|지도`, `지도로`, `새 창으로` and ×.
2. **Phone, map mode: the map is only about 450 px tall**, with about 400 px of empty panel below the controls.
   - The credit line and the controls sit flush against the left edge (no 16 px gutter).
   - `‹ 5일차 ›` touches the right edge at both widths.
3. **Controls look like plain text.** `재생`, `전체`, `따라가기`, `‹`, `›` are raw `<button>`s (`web/src/ui/mapwalk.jsx:301-336`). The rest of the panel uses Astryx `Button` (`import { Button } from "@astryxdesign/core/Button"`, as in `web/src/ui/chat.jsx:23`).
4. **Desktop, after `전체`:** the `B` home pin is cut by the top edge. The fit uses only route points, so the pin's radius sticks out.
5. **No station names on the map.** You cannot tell where the ride changes lines (남한산성입구 → 모란 → 이매 → 판교).

## Change
1. **Header** (`ui.css:874-885`, plus the `SceneFrame` markup only if a wrapper is needed).
   - The head row wraps (`flex-wrap: wrap`). The title takes its own full-width first line when it does not fit, and is never clipped or ellipsised.
   - At ≤ 480 px, hide `새 창으로` (it is desktop-only).
2. **Map size.** `.ui-mapwalk` becomes a column flex that fills the panel height. The SVG takes the remaining height (`flex: 1 1 auto; min-height: 240px`), and the viewBox is computed from the measured box (a ResizeObserver on the wrapper; fall back to 4:3 in SSR). Controls sit at the bottom.
3. **Gutters.** The credit, controls and activity line get `padding: 0 16px`. Controls stay one wrapping row:
   - `Button` play/pause (`size="sm"`);
   - the slider (`flex: 1 1 160px; min-width: 120px`);
   - day nav as `Button size="sm" variant="ghost"` `‹` / `›` around the day label.
   - A second row holds `전체` and `따라가기` as `Button size="sm" variant="secondary"`. `따라가기` uses `aria-pressed` and a filled look when on.
   - Nothing may overflow at 390 px or 1440 px; all text ≥ 14 px except the credit (12 px, the same as ChatMap's credit).
4. **Fit padding.** Pass an inset to `fitMapView` (`web/src/chatmap.js:184`, it already takes `inset`) of at least 28 px on every side, so the home pin, the work square and the station labels stay inside.
5. **Station labels.** For each ride segment, label its first and last station: a small white pill, 14 px text, dark text, 1 px border.
   - Deduplicate shared stations (모란 appears once).
   - The text is the station name; in English, the existing `romanize`/name helper output.
   - Drop a label that would overlap an earlier one: a simple rect test against placed labels, in order.

## Tests — extend `web/tests/mapwalk-38c.test.js`
- **Pure `stationLabelsFor(segments)`:** for the two-leg ride from 38c2 (8호선 남한산성입구→모란, 수인·분당선 모란→이매), returns `["남한산성입구","모란","이매"]` in order.
- **Pure `placeLabels(items, measure)`:** two items at the same point → only the first is kept.
- **SSR:**
  - `MapWalk` with a ready fixture renders Astryx buttons (the class the Astryx `Button` renders; assert by the same marker other SSR tests use) and no raw `<button type="button" … style=` controls;
  - the station label text appears.
- **CSS check (read `ui.css`):** `.ui-chat-scene-head` has `flex-wrap: wrap`, and `.ui-chat-scene-title` no longer has `white-space: nowrap`. No `text-overflow` anywhere in the file (an existing rule).
- **Keep green:** web tests matching `mapwalk|SceneFrame|ui\.css`.

Run only:
```
cd web && node --test tests/mapwalk-38c.test.js $(grep -lE "mapwalk|SceneFrame|ui\.css" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/**`, `web/src/main.js`, `web/src/consult/**`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
