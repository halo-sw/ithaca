# Stage 36h — line geometry stored in travel order (the 8호선 ride is drawn going the wrong way) (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; the suite is green (2823). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium + node, new demo, 2026-11-01)
1. **What the viewer sees.** A's ride, 07:48–07:58, 8호선 석촌 → 복정: the map is empty beige, with only the `8호선 · 나` marker. The 9호선 (07:46) and 수인·분당선 (08:00) parts are fine. Evidence: `briefs/img/fid-line8-beige.jpg`.
2. **Where the marker goes.** `trainPosition(network, ride, e)` (`web/src/journey.js:145`) on the real build, A's day-1 ride:

   | elapsed | leg | lat | should be |
   |---|---|---|---|
   | 6 | 8호선 | 37.5569 | 37.50 (석촌) → 37.47 (복정) |
   | 10 | 8호선 | 37.5786 | as above |
   | 32 | 경강선 이매 → 판교 | 127.628, 37.283 (여주) | near 127.11, 37.39 |

   So the marker runs north toward 천호/구리, then jumps to 여주.
3. **Cause.**
   - `_chainage_km` (`pipeline/network.py:301-378`) projects the stops on the chain both ways. When the reversed chain has more forward pairs it keeps `rfracs`, so the chainage is measured from the travel-order start.
   - The caller (`:477-511`) still writes the **unreversed** `p["chained"]` as `geometry`.
   - Every consumer reads the geometry assuming it starts at `stops[0]`: `pointAtChainage` in `journey.js:196`, `journey-scene.js:276`, and `motion/trains.js:72-116`.
4. **Reversed patterns today.** First stop is about 0 km from the geometry's **last** point and 46–95 km from its first. Measured on `data/build/region/network.json`:

   ```
   line8:down:2718901, line8:up:7919018,
   line5:up:12497485, line5:down:12497486, line5:up:19427674,
   line7:down:12746493, gyeonggang:toward:6462563, line2:down:4729407
   ```

   Loops (`line2:outer`/`inner`) are equal both ways; leave them.
5. **Minutes are not affected.** The path finder and the engine use only `chainage_km` differences (`engine/journey.js:72`, `pipeline/corridor.py:93`).
6. **Determinism.** Rebuilding in memory from the cached prefilter today gives a file identical to the current one:

   ```
   build_network(_cache/network-routes.osm.pbf, _cache/network-members.osm.pbf, congestion)
   ```

## Change
1. **`pipeline/network.py`.**
   - `_chainage_km` also reports whether it chose the reversed chain, e.g. return `(kms, methods, coords_in_travel_order)`, or a flag. Keep its existing callers and tests working: add a new return field or a sibling helper rather than breaking the 2-tuple, whichever is smaller.
   - The caller writes the geometry in travel order (the reversed chain when reversed was chosen) before simplifying.
   - `_mirror_pattern` already reverses the long sibling's geometry. It stays correct once the long one is in travel order.
2. **Do not touch `web/src`.** Every consumer already assumes travel order. The orchestrator rebuilds `network.json` afterwards.

## Test
1. **`tests/test_network.py`** (pipeline):
   - **Synthetic case:** a chain drawn from the last stop to the first. The built pattern's `geometry[0]` is within 50 m of `stops[0]`, and `chainage_km` is unchanged from today's value.
   - **Real-data case** (skip when `data/build/_cache/network-routes.osm.pbf` is missing): `build_network` on the cache. For every non-loop pattern, `geometry[0]` is nearer to the first stop than `geometry[-1]` is.
2. **New `web/tests/line-direction-36h.test.js`.** Skip when `data/build/region/network.json` is missing. It goes green only after the orchestrator rebuilds the network, so write it, run it, and report it as expected-red.
   - Every non-circle pattern's `geometry[0]` lies within 1 km of its first stop.
   - A's day-1 ride (`data/build/sim/demo-two-homes-A.json`, the first ride with `legs[0].patternId`): at every elapsed minute of the 8호선 leg the marker lat is between 37.465 and 37.510. At the 경강선 leg the marker is within 3 km of 판교 (127.1112, 37.3948).

Run only:
```
.venv/bin/python -m pytest -q tests/test_network.py 2>&1 | tail -3
cd web && node --test tests/line-direction-36h.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
If pytest still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`web/src/**`, `src/i18n/**`, `relay/**`, `data/` (do not write `network.json`; the orchestrator rebuilds it), `README*`, `scenarios/`, `public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
