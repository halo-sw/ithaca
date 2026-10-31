# Stage 29N1b — US corridor data fixes: SF station, real names, Anton Menlo, direct bike, clean Caltrain CSV (pipeline, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite. Run the pipeline only on test fixtures; the orchestrator runs the real build. First edit within 3 tool calls. Stop when the named tests pass.

## Why — orchestrator real build of 29N1 (2026-11-01)
1. `BUILD FAILED: us-st-san-francisco: station 'San Francisco': no railway station match` — the OSM station is named like `San Francisco Caltrain` / `4th & King`. The other six boxes built.
2. Mountain View homes are named `1`, `10`, `11` (house numbers used as names; 210 homes).
3. **Anton Menlo** is in OSM only as a named node (`name=Anton Menlo Park`, node 6620890932 in `data/build/us-menlo/extract.buffered.osm.pbf`), not a building way, so it is not a candidate — the product owner named it as the popular complex (walk-bridge + Meta shuttle).
4. Only the Caltrain route is computed. From downtown Palo Alto that gives `walk 7.7 + wait 7.5 + Caltrain 3 + bike 22.2 = 40 min`, while biking straight to Meta HQ (~6 km) is faster. New hires compare walk / bike / Caltrain / shuttle.
5. `scenarios/transit/caltrain-interstation.csv`: `소요시간` is written as bare minutes (`6`) while the Seoul file uses `MM:SS` (`02:00`); stations no AM local trip serves back-to-back (Broadway, Burlingame, Stanford, California Avenue) have an empty `소요시간`.

## Changes
1. Station match for US boxes falls back to the GTFS parent-station coordinate (`stops.txt`, `location_type=1`, matching `stop_name` starts with the box's station) when no OSM `railway=station` name matches; `San Francisco` matches `San Francisco` / `4th & King`.
2. US home names: a name that is only digits (or digits + unit letter) is not a name → use the OSM address (`<housenumber> <street>`) like other unnamed homes; if none, the existing fallback.
3. Named residential nodes (`building=apartments|residential` on a node, or a node with `name` + `addr:*` + a residential tag, or `name~"Anton Menlo"`) attach to the nearest candidate building within 60 m (the building takes the node's name, `match: "osm_node_name"`); if no building is within 60 m, the node itself becomes a candidate home at its coordinate. Anton Menlo must appear in `homes/us-menlo.json`.
4. **Commute modes per home** (all US areas, labelled):
   - `bike_direct_min`: on the area walk/bike graph when HQ is inside the area (us-menlo); otherwise straight-line km × 1.3 at the assumed 15 km/h (`source: "estimate"`).
   - Caltrain route as 29N1 (station boxes).
   - `best: { mode: "bike" | "walk" | "caltrain", min }` = the fastest of walk (only when ≤ 40 min), bike_direct, Caltrain route; `total_min` stays the Caltrain route for station boxes, plus the new `best`.
   - For SF / Belmont / San Carlos the bike estimate will be long — keep it, `best` picks Caltrain.
5. Caltrain CSV: write `소요시간` as `MM:00` (`06:00`), and fill an empty segment by distance-proportional interpolation between the neighbouring served segments (flag those rows in `caltrain-am.json` `meta.interpolated`).

## Tests — extend `tests/test_caltrain_29N1.py`
- Fixture GTFS + an OSM-less box: the station resolves from the GTFS coordinate.
- Digit-only names become `"<n> <street>"`; a fixture named node within 60 m names its building; a node with no building nearby becomes its own home.
- `best` for a fixture home 6 km from HQ with a 40-min Caltrain route is `bike` with the estimate; for 30 km it is `caltrain`.
- CSV rows use `MM:00`, no empty `소요시간`.

Run only:
```
.venv/bin/pytest -q tests/ -k "caltrain or homes_us or boxes or regions or us_area" 2>&1 | tail -3
```

## Do not touch
`web/`, `relay/`, `data/`, `briefs/`.

## Final message
Changed files, one line each, and the exact rebuild commands in order. Nothing else.
