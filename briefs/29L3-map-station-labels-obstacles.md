# Stage 29L3 — The candidate map stops doubling station names, and nothing we draw covers a station (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep to find the rest). Stop when the named tests pass.

## Why
Orchestrator capture, 2026-11-01, Seoul 강남 desktop 1440×900: the VWorld white basemap already prints its own station names, and ours sit a few pixels off them, so the map reads `청담 청담역`, `강남구청 청역`, `선릉 릉역`, `역삼` over `역삼역`. Also the workplace pill `■ 회사 · 강남` sits on top of 강남역's dot and name, and the legend card (`번호·면적 / 가격 / 출근 시간 …`) covers a station name at its right edge.

## Changes
1. **One station name, ours (`web/src/ui/chatmap.jsx` station label text, `~:820-880`; layout in `web/src/chatmap.js` `layoutStationLabels`).** Paint each of our station labels on a small backplate in the map ground colour (`MAP_COLORS` — add a `stationPlate` token if none fits; rounded, 2–3 px padding, opacity 0.92) so the basemap's own label underneath is covered, and use the full name with 역 (`강남역`, `English: Gangnam Stn` — use whatever name helper the label already uses, adding 역 / Stn only when the name lacks it). Keep the existing font size.
2. **Obstacles.** `layoutStationLabels(stationPts, W, H, pinBoxes)` also avoids: the workplace pill's box, the legend box, the filter row / title boxes and the right-side controls — reuse the measured chrome boxes the map already collects for fitting (`chatmap.jsx:~184-260`, the `chrome` state). A label that fits nowhere is dropped (never drawn under a box).
3. **Workplace pill.** Place the workplace pill with the same side-picking the price tags use (try right, left, above, below of its point) and treat the station dots and station label boxes as things to avoid; if all sides collide, keep the right side but add a short leader line (as the tags do).

## Tests — new `web/tests/map-stations-29L3.test.js`
- `layoutStationLabels` with an obstacle box covering a station's default label position puts that label elsewhere or drops it; never returns a label box intersecting any obstacle.
- The station label text for `강남` is `강남역` (Korean) and `Gangnam Stn` (English); for `강남역` input it stays `강남역`.
- The workplace pill placement helper picks the left side when the right side overlaps a station label box.
Keep `31*` map tests green.

Run only:
```
cd web && node --test tests/map-stations-29L3.test.js $(ls tests/*31[a-n]*.test.js tests/*29k2*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
The 3D scene (`main.js`, `render/*`, `labels3d.js`), consult/verify, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
