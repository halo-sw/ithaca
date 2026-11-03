# Stage 60a2 — three fixes after the first real run of baseline-commute.mjs (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Edit only `web/scripts/baseline-commute.mjs` and `web/tests/baseline-commute-60a.test.js`. Stop when done.

## Seen (orchestrator ran the CLI on the real data)
1. **`writeFile` is used but never imported.** The CLI computes every row, then throws `ReferenceError` at the end. It is used at the end of `main()` and the import is on line 1.
2. **Gzipped data.** The current data release stores many files only as `.json.gz`, for example `st-정자/area.json.gz` with no `area.json`. `read()` in `main()` fails with ENOENT.
3. **US station names.** For 2 of 6 US homes the station point is not found: `Redwood City Transit Center` and `Sunnyvale Transit Center` are not names in `region-us/network.json`, which uses `Redwood City` and `Sunnyvale`. The engine itself boards at a station **POI inside the home area**: `web/src/engine/places.js:111` `stationsByName` matches `STATION_CATS` (`places.js:15`) and `normalizeStation` (`web/src/engine/journey.js:26`). An area POI looks like this:
   `{"category":"railway:station","geometry":{"type":"Point","coordinates":[lon,lat]},"name":"Menlo Park",…}` in `area.pois`.

## Change (only `web/scripts/baseline-commute.mjs`)
1. Import `writeFile` from `node:fs/promises`.
2. `read(root, rel)` tries the plain file first. On ENOENT it reads `rel + ".gz"` as a Buffer and returns `gunzipSync(buf).toString("utf8")`, with `gunzipSync` from `node:zlib`.
3. Export `stationPointFromArea(area, stationName, homeLonLat)`:
   - candidates are `area.pois` entries with `STATION_CATS.has(p.category)` and `normalizeStation(p.name) === normalizeStation(stationName)` and finite `geometry.coordinates`;
   - return the `[lon, lat]` nearest to the home (`haversineM`), or `null`.
   - In `main()`, use `stationPointFromArea(await loadArea(home.scene), stationName, [home.lon, home.lat])` first. Use `stationCoords(region.network, …)` only when that is `null`.
   - The reason for neither is `"station point not found"` instead of `"station not in network"`. Update the same string inside `buildRow`.

## Test — add to `web/tests/baseline-commute-60a.test.js` (keep every existing test as it is)
`stationPointFromArea` on a fixture area with 3 POIs:
- two `railway:station` named `Palo Alto` and `Palo Alto Caltrain`, at different distances;
- one `amenity:cafe` named `Palo Alto`.

It returns the nearer station's coordinates and never the cafe's. With no matching POI it returns `null`.

Run only: `cd web && node --test tests/baseline-commute-60a.test.js 2>&1 | tail -15`. Do not run the CLI.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.
