# Stage 36g2 — finish 36g: the follow marker does not jump at the station, the aerial credit in English, the tests (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 36g's label fix is committed: a ride is `estimate` when any leg is an estimate. First edit within 2 tool calls. Do not re-survey; the pointers below are your own 36g notes. Stop when the named tests pass.

## 1. Marker continuity (`docs/3d-fidelity.md` item 7)
The walk ends at the OSM station node, and the ride starts at the line data's stop, which can be about 145 m away, so the follow marker leaps.
- **Where.** The drawn ride path is built in `web/src/journey-scene.js` `setPath`; the marker position is in `trainPosition` (`web/src/journey.js`). The boarding and alighting ends are resolvable in `main.js` `journeyFrame` via `indexed` trips + `nodeLonLat`.
- **Change.** When a ride is drawn, prepend the boarding walk's end point (the station node the walk reached) and append the alighting walk's start point. The marker then moves continuously from walk to train. This is drawing only: the minutes, the km and the leg times stay unchanged. Put the join in a pure exported helper, e.g. `joinWalkToRide(walkEnd, ridePath, walkStart)` in `journey.js`, used by `main.js`.

## 2. English credit (`SimCredit` in `web/src/ui/app.jsx`)
- **Korean.** Keep it exactly as today.
- **English.** Build the whole line as one string:
  - `Aerial photo © MOLIT Spatial Information Open Platform (VWorld) · © OpenStreetMap` when the photo is draped;
  - `© OpenStreetMap` otherwise.
- **Render.** Show it in one element with `data-no-i18n`, as the 29a6b replay banner does.
- **US.** US areas keep their USGS credit.

## Test — new `web/tests/official-marker-36g.test.js`
- **Labels** (36g):
  - legs `[schedule, estimate]` → `estimate`;
  - `[schedule, schedule]` → `official`;
  - customer ride → `said`;
  - same station → unchanged.
  - Real data (skip without `data/build`): `commuteSummary` for `home-014844` → 판교 through `commuteRowLine` → estimate. The schedule comes from `scenarios/transit/seoul-metro-interstation.csv`, as in `ride-times.test.js`.
- **Marker:** `joinWalkToRide(P, [Q, …], R)`, with Q 145 m from P, starts at P and ends at R, with no gap > 5 m at the joins.
- **Credit:**
  - SSR `SimCredit` in English with `aerial: true` contains `Aerial photo © MOLIT` and no Hangul;
  - Korean is unchanged.
- **Keep green:** every test that mentions `commuteRowLine`, `SimCredit`, `trainPosition` or `setPath`.

Run only:
```
cd web && node --test tests/official-marker-36g.test.js $(grep -lE "commuteRowLine|SimCredit|trainPosition|setPath" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `README*`, `scenarios/`, `pipeline/**`, `public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
