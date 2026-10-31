# Stage 29N1 — US homes along the Caltrain corridor: Caltrain network from GTFS, station boxes, homes with their own ZIP rent (pipeline, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite. You may run the pipeline only on the tiny test fixtures; the orchestrator runs the real build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Today every US search returns six homes on one street in Belle Haven / East Palo Alto (`us-menlo`, one bbox around Meta HQ, 61 homes, nearly all ZIP 94025 → the same $4,261 rent). The product owner's brief for new Meta hires (2026-11-01) names where they actually look:
- **Menlo Park itself, esp. Belle Haven** — closest to HQ, walk / bike / shuttle; complexes like **Anton Menlo** (walk-bridge + Meta HQ shuttle) are popular. → keep `us-menlo`.
- **Redwood City, San Carlos, Belmont** (Peninsula) — reasonable commute, more choice, a bit cheaper; Caltrain.
- **Palo Alto, Mountain View** — popular, good living, expensive.
- **Sunnyvale** — relatively cheaper, also has a Meta office.
- **San Francisco** — lifestyle-first new hires commute by shuttle / Caltrain.
- East Bay (Fremont) — across the bridge, shuttle only: **not modelled in this stage** (no public transit line we can compute; Meta shuttle routes are not public).
All local data already exists: `data/raw/us/norcal-latest.osm.pbf`, `data/raw/us/caltrain/caltrain-ca-us.zip` (GTFS, 2026-06), `data/raw/us/zillow/Zip_zori_uc_sfrcondomfr_sm_month.csv` (all ZIPs).

## Changes (pipeline, Python; mirror the Korean box machinery rather than inventing new shapes)
1. **Caltrain network — new `pipeline/caltrain.py` + CLI `python -m pipeline caltrain`.**
   - Read the GTFS zip (stops, trips, stop_times, calendar). Parent stations (`location_type=1`) are the stations.
   - Write `data/build/region-us/network.json` in the **same schema as** `data/build/region/network.json` (`lines` with one line `{id:"caltrain", name:"Caltrain", patterns:[…stations in order SF→San Jose, chainage_km from stop coordinates or shapes]}`, `transfers: []`, `meta.source: "Caltrain GTFS (2026-06)"`).
   - Write `scenarios/transit/caltrain-interstation.csv` in the same columns as `scenarios/transit/seoul-metro-interstation.csv` (`연번,호선,역명,소요시간,역간거리(km),호선별누계(km)`; 호선 = `Caltrain`; 역명 = the station's English name without " Station"/" Caltrain"), where 소요시간 between consecutive stations is the **median of weekday 07:00–09:30 trips that stop at both** (local/all-stop pattern — express trains skip stations; note it in `meta`).
   - Also write `data/build/region-us/caltrain-am.json`: for each station, weekday 07:00–09:30 departures toward Menlo Park (southbound for stations north of it, northbound for stations south), the median ride minutes **to Menlo Park station**, and the median headway — so the app can show `Caltrain 23 min, every 20 min` without recomputing.
2. **US station boxes.** In `pipeline/regions.py` (next to the `us-menlo` spec, `:~402`), add a US Caltrain box list with ids `us-st-<slug>` and the Caltrain station each one centres on: `San Francisco` (4th & King), `Belmont`, `San Carlos`, `Redwood City`, `Palo Alto`, `Mountain View`, `Sunnyvale`. Same 1.2 km box as Korean station boxes; build through the existing box/area path (`pipeline/boxes.py`, `area_build`, `cmd_boxes`/`cmd_build`) from the norcal PBF, `country: "US"`, `currency: "USD"`, workplaces `[meta-hq]` like `us-menlo`'s `area_def.json`. Generalise where `boxes.py` assumes Korean metro tags (`_is_metro_station`) so a Caltrain station (`railway=station` + `operator`/`network` Caltrain, or the GTFS coordinate) can centre a US box.
3. **US homes per box — generalise `pipeline/homes_us.py`.** For each US area (`us-menlo` + every `us-st-*`): candidate buildings as today (OSM `apartments`/`residential`/`dormitory`, prefer named), ZIP per home from the nearest `addr:postcode` within 600 m (existing `zip_for`), with a per-box default ZIP table when none (SF 94107, Belmont 94002, San Carlos 94070, Redwood City 94063, Palo Alto 94301, Mountain View 94041, Sunnyvale 94086, Menlo Park 94025); rent = ZORI for that ZIP (latest month, as today). `station` = `{station: "<Caltrain station>", walk_minutes}` from the box walk graph. Write `data/build/homes/us-<area>.json` per area in the existing slim shape, plus append each to `data/build/homes/summary.json` like the Korean files. Make sure **Anton Menlo** (OSM name contains "Anton Menlo", inside `us-menlo`) is kept as a candidate when present.
4. **Commute facts on each US home (precomputed, labelled):**
   - `us-menlo`: keep walk / bike to Meta HQ as today.
   - `us-st-*`: `commute = { walk_to_station_min, caltrain_min, headway_min, last_mile: { bike_min, walk_min, shuttle_min_assumed: 15 }, total_min }` where the ride goes to **Menlo Park** station, last mile Menlo Park station → Meta HQ on the `us-menlo` graph (bike/walk, computed; shuttle is an explicit assumption: Meta runs its own connector, schedule not public → 15 min incl. wait, flagged `assumed: true`), `total_min = walk + headway/2 + caltrain + bike` (bike is the computed default). Sunnyvale: Caltrain northbound to Menlo Park (same formula).
   - Every number carries a `source` (`caltrain_gtfs`, `osm_graph`, `assumed`).

## Tests — new `pipeline/tests/test_caltrain_29N1.py` (or the repo's Python test location; grep for an existing `test_homes_us`)
- A 4-station fixture GTFS (write it in the test as a temp zip): network.json has one `caltrain` line with stations in order and increasing chainage; the CSV has the Korean column headers and median minutes; `caltrain-am.json` gives ride minutes to Menlo Park and a headway.
- A fixture ZORI with two ZIPs: homes in two boxes get different `monthly.median_won` values (the field name is reused for USD, as today).
- A US box spec resolves to `us-st-palo-alto`, `country: "US"`, `currency: "USD"`.
- `total_min` = walk + headway/2 + caltrain + bike for a fixture home.
Keep green: the existing Python tests for `homes_us` / `boxes` / `regions` (find them with `grep -rl "homes_us\|boxes\|regions" pipeline/tests tests 2>/dev/null`).

Run only (adjust the path to where the repo's Python tests live):
```
python3 -m pytest -q pipeline/tests -k "caltrain or homes_us or boxes or regions" 2>&1 | tail -5
```

## Do not touch
`web/`, `relay/`, `data/` (outputs are written by the orchestrator's real run), `briefs/`.

## Final message
Changed files, one line each, and the exact commands the orchestrator should run to build the real data (Caltrain network, US boxes, US homes), in order. Nothing else.
