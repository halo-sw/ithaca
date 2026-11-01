# Stage 29N3 — "Live 30 days" for US Caltrain homes: walk to the station, wait, Caltrain to Menlo Park, bike (or assumed shuttle) to Meta HQ (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why
29N1/29N2 added US homes in seven Caltrain station boxes (`us-st-san-francisco`, `-belmont`, `-san-carlos`, `-redwood-city`, `-palo-alto`, `-mountain-view`, `-sunnyvale`). Cards already show `Caltrain 44 min · walk 10 + wait 8 + train 4 + bike 22`. But "Live 30 days" only knows the US commute "walk or bike from the home to Meta HQ" (`commuteToPlace`, `web/src/engine/routines.js:~600-690`, built by `web/src/profile.js:~1036-1044` as `work.type: "place"`). For a Palo Alto home that is a 6 km bike ride over the box edge → `unavailable`. The orchestrator has built every box's `area.json`, `graph.json` and now `scene.json` (3D, with terrain) under `data/build/us-st-*/`, and `data/build/region-us/network.json` + `caltrain-am.json`. Open one `homes/us-st-palo-alto.json` home and `region-us/caltrain-am.json` to see the real shapes.

The Korean engine already does exactly this shape: `commutePlace` (`routines.js:~436-600`) = walk to the home station → ride (`buildRides` on `region.network`, per-path minutes split by distance) → `planDestWalk` (`~406-427`) from the alighting station to the workplace on the destination area graph (`ctx.dest`, loaded by `web/src/engine/destload.js`). Reuse it; do not write a second commute engine.

## Changes
1. **Scenario (profile → scenario), `web/src/profile.js:~1036`.** When the picked home is in a `us-st-*` area (home has `station.station` and a `commute` block), build
   `work = { type: "station_ride", station_name: {<label>: "<Caltrain station>"}, destination_station: "Menlo Park", ride_minutes: {<label>: commute.caltrain_min}, ride_minutes_source: "caltrain_gtfs", wait_minutes: {<label>: commute.headway_min / 2}, wait_minutes_source: "caltrain_gtfs_half_headway", last_mile: { mode: "bike", shuttle_min_assumed: 15 }, place: { name: "Meta HQ (1 Hacker Way)", lon, lat } }` with the scenario's `dest_area: "us-menlo"`. `us-menlo` homes keep today's `type: "place"` walk/bike. Two picked homes may mix (A Belle Haven, B Palo Alto): per-home maps as the Korean form already allows (`nameForHome`, `rideMinutesForHome`, `destForHome`).
2. **Engine, `routines.js` + `scenario.js` parse.**
   - `wait_minutes` (optional per-home map): added before boarding as its own away record `kind: "wait"` (label `열차 대기` / English `Waiting for Caltrain`), cause criterion `C-ride-wait` (new, `scenarios/criteria/kr-default.json` entry in the same shape: "Caltrain 대기 = 아침 배차 간격의 절반(GTFS)", value `half_headway`, source `데이터: Caltrain GTFS`). Absent → today's behaviour (Korea adds no wait, unchanged).
   - `last_mile.mode === "bike"`: `planDestWalk` becomes `planDestLeg` — on the destination area use a bike router (`new Router(dest.graph, { mode: "bike" })`, as `simulate.js:~34` builds `ctx.bikeRouter`; build it in `destload.js` when the graph has bike edges) and `F.bike_mps`; `dest_walk` detail gains `mode: "bike"`; trips added with `{ mode: "bike", speedMps: F.bike_mps }` like `commuteToPlace`'s bike branch. If no bike route → a fixed `shuttle_min_assumed` leg, `source: "assumed"`, note `Meta shuttle (assumed, schedule not public)`. Korean scenarios (no `last_mile`) are byte-identical.
   - Ride label: the ride away is `지하철 이동` today; when the ride's line is `caltrain` label it `Caltrain` (both languages). Congestion: Caltrain has no data → the existing fallback with `source: "가정값"` (already the path when `hasData` is false).
3. **Region data for the run.** Wherever a run loads `region/network.json` + `congestion.json` — `web/src/sim-worker.js:~34`, `web/src/consult/server.js:~111`, `web/src/main.js:~2633` — a run whose home areas are `us-*` loads `region-us/network.json` (no congestion file → null). Station lookup: `stationsByName(places, "Palo Alto")` must find the box's Caltrain station POI; if OSM names it `Palo Alto Caltrain` / `Palo Alto Station`, normalise (strip ` Caltrain`, ` Station`) in one helper used by both `stationsByName` and the network lookup.
4. **Gates.** Grep `simReadyFor`, `homeForScenario`, `verifyHomeFor` and the consult `build_scenario` / `run_simulation` tools (`web/src/consult/tools.js`) for any "US = us-menlo only" or "needs scene" rule and extend it to `us-st-*` (scene.json now exists for all seven).

## Tests — new `web/tests/us-caltrain-30d-29N3.test.js`
- `scenarioFromProfile` (or the builder you changed) for a Palo Alto home → the `station_ride` work above (station `Palo Alto`, dest `Menlo Park`, ride/wait from the home's `commute`, `last_mile.mode: "bike"`, `dest_area: "us-menlo"`); a Belle Haven home still gives `type: "place"`.
- Real build (skip with a clear message when `data/build/us-st-palo-alto/area.json` or `data/build/us-menlo/area.json` is missing): simulate 3 days for one Palo Alto home → day 0 commute shows, in order, a walk trip to the Palo Alto station, a `wait` away of `headway/2` minutes, a ride away whose legs are on line `caltrain` from `Palo Alto` to `Menlo Park`, and a bike trip to Meta HQ; door-to-door minutes within ±3 of the home's `commute.total_min`; no `unavailable` commute record.
- A Korean scenario fixture (reuse one from `tests/` that runs `commutePlace`) produces the same JSON as before (no `wait`, no `mode` on `dest_walk`).
Keep green: `tests/us-corridor-29N2a.test.js`, `tests/map-us-live-29N2e.test.js`, and every engine test (`grep -l "commutePlace\|station_ride\|dest_walk" tests/*.test.js`) — list any expectation you updated (there should be none for Korean runs).

Run only:
```
cd web && node --test tests/us-caltrain-30d-29N3.test.js tests/us-corridor-29N2a.test.js $(grep -l "commutePlace\|station_ride\|dest_walk" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `relay/`, `briefs/`, the demo scenario and its recorded numbers.

## Final message
Changed files, one line each, plus any expectation you updated. Nothing else.
