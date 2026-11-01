# Stage 38a — every home gets a 3D neighbourhood: all stations boxed, plus home boxes where no station is near, and the homes rebuild works again (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build, no pipeline runs on `data/`. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (measured on `data/build`)
- **Only 46% of homes can open a 3D neighbourhood.** 8,344 of 18,035 homes have `scene`. A home gets `scene` when a built `bbox` area contains it (`pipeline/homes.py:255-300`, `load_box_graphs` / `containing_box`).
- **Boxes exist for 60 stations only.** `select_boxes` (`pipeline/boxes.py:203-262`) caps at `max_boxes` (60). 63 more stations were skipped.
  - Boxing every station would cover 14,462 homes (80%).
  - 3,573 homes would still sit outside every station box. A greedy cover with 1.2 km squares centred on those homes needs 40 boxes for 3,126 of them and 80 boxes for 3,490.
- **The homes rebuild drops to 1,118 homes.** Cause, proven:
  - `regions.json` now carries `us-menlo` (`"country": "US"`, bbox around −122.19).
  - `run_build` (`pipeline/homes.py:796-815`) takes `combined_bbox` over every region, so the register stream bbox spans Seoul to California. The EPSG:5186 reprojection then matches nothing: `rows_matched_register` is 0 in every region.
  - Rebuilding with a regions file without `us-menlo` gives exactly 18,035 homes, the same as today.
- `run_discovery` (`pipeline/boxes.py:384-420`) also loops over every region, so it would scan `us-menlo` against the Korean PBF.

## Change
1. **Homes rebuild** (`pipeline/homes.py` `run_build`).
   - Drop regions whose `country` is `"US"` (or whose id starts with `us-`) before `read_region_rows`, `combined_bbox` and `_region_filters`.
   - The US build stays on its own path (`--us`).
2. **Discovery skips US regions** the same way (`run_discovery`).
3. **Home boxes** (new function `select_home_boxes` in `pipeline/boxes.py`, called by `run_discovery` after `select_boxes`).
   - **Input:** `data/build/homes-index.json` (`homes` rows with `lon`, `lat`, `region`) when it exists; with no file, no home boxes.
   - **Coverage test:** a home is covered when it lies inside `bbox_from_center(lon, lat)` of any selected station box.
   - **Greedy cover** of the uncovered homes:
     - Candidate centres are the uncovered home points.
     - Pick the centre whose 1.2 km box (same `bbox_from_center`) holds the most uncovered homes, mark those covered, and repeat.
     - Stop when the best box holds fewer than `MIN_HOME_BOX_HOMES = 8` homes or after `MAX_HOME_BOXES = 80` boxes.
     - Ties break by lower lon, then lat, so the result is deterministic.
     - Use a grid bucket (about 600 m cells) so this is not O(n²) over every pair.
   - **Row shape:** `{"id": "hm-<region>-<NN>", "lon", "lat", "region", "region_label", "homes": <count>, "label": "<name> 일대"}`. `NN` is two digits in pick order per region.
   - **`<name>`:** the nearest OSM `place=quarter|neighbourhood|suburb` node within 1 km of the centre, from the region extract already scanned. Extend `scan_region_extract` to also collect those nodes (name + lon/lat). Fall back to the region label without the city prefix (`강동구`).
   - **Output:** written to `station-boxes.json` under a new key `home_boxes`, plus `"home_boxes": <n>` and `"homes_uncovered_after": <n>` in the summary.
4. **Home boxes build like station boxes.** Same 1.2 km `bbox` kind, manifest and incremental skip.
   - `pipeline/areas.py:421-458`: add `HOME_BOX_PREFIX = "hm-"`, `is_home_box(id)`, and `resolve_home_box(id, build_dir)`. It reads the row from `home_boxes` and returns `AreaDef(id, label=row["label"], kind="bbox", bbox=bbox_from_center(...), center, station=None, boundary=None)`.
   - **`pipeline/cli.py`:**
     - `build_area` (`:48-96`) accepts `hm-` ids and records them like station boxes. Wherever it resolves an area def for a station box, add the home-box branch.
     - `_box_signature` (`:97-…`) handles `hm-` from `home_boxes`. `manifest_signature` takes a row; use `row["id"]` where it uses the station.
     - `expand_area_patterns` (`:150-190`): `home:*` selects every home box, and `region:<id>` also includes that region's home boxes.
   - If a downstream stage needs a station (for example the station POI), a home box with no station inside must still build. Skip only that station-specific piece.
5. **Station cap.**
   - Change `MAX_BOXES` to 200 and the CLI default `--max-boxes` to 200 (`pipeline/cli.py:~589`).
   - Station rows keep their order and flags. The 60 existing rows must keep identical coords, so their manifests still match and they are not rebuilt.
6. **App lookups for `hm-` scenes.** Three places assume scene ids start with `st-`:
   - `web/src/consult/tools.js:333-340` (`knownArea`): also accept `hm-`.
   - `web/src/consult/tools.js:1188-1199` (`safetyKeyFor`) and `web/src/consult/tools-money.js:55-63` (`rtmsDistrictForArea`): for `hm-` ids, find the row in `doc.home_boxes` by `id` and use its `region`.

## Tests
**New `tests/test_boxes_38a.py`:**
- **US filter:** `run_build`'s region filter (factor it into a small helper, e.g. `korean_regions(regions)`) drops a `{"id": "us-menlo", "country": "US"}` row and keeps `seongdong`.
- **`select_home_boxes`:**
  - Synthetic homes: 20 points inside one 1 km square far from any station, 5 points elsewhere, 10 points inside a station box. Result: one home box holding 20; the 5 are left uncovered (below 8); the 10 are never counted.
  - Deterministic: same input gives the same ids.
  - Ids look like `hm-gangdong-01`.
- **Name pick:** nearest place node within 1 km wins; with none, the label is the region fallback + ` 일대`.
- **Patterns and resolve:** `expand_area_patterns(["home:*"], tmp)` lists the `hm-` ids from a temp `station-boxes.json`. `resolve_home_box` returns a `bbox` AreaDef with that label.
- **Cap:** `select_boxes` with 70 qualified stations and the default cap keeps all 70.

**New `web/tests/home-boxes-38a.test.js`:** `rtmsDistrictForArea` with a session whose `loadStationBoxes` returns `{ boxes: [], home_boxes: [{ id: "hm-gangdong-01", region: "gangdong" }] }` resolves `hm-gangdong-01` to the gangdong district.

**Keep green:** `tests/test_boxes*.py`, `tests/test_homes*.py`, `tests/test_cli*.py`, `tests/test_areas*.py` (whichever exist) and the web tests that mention `rtmsDistrictForArea|safetyKeyFor|knownArea`.

Run only:
```
.venv/bin/pytest -q tests/test_boxes_38a.py $(ls tests/test_boxes*.py tests/test_homes*.py tests/test_cli*.py tests/test_areas*.py 2>/dev/null | tr '\n' ' ') 2>&1 | tail -15
cd web && node --test tests/home-boxes-38a.test.js $(grep -lE "rtmsDistrictForArea|safetyKeyFor|knownArea" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `web/src/i18n/**`, `web/src/ui/**`, `web/src/main.js`, `pipeline/network.py`, `pipeline/regions.py`, `README*`, `scenarios/`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
