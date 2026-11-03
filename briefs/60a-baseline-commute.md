# Stage 60a — measured baseline: listing-style commute vs the engine's door-to-door (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Why
This is analysis only and adds no product feature. Question: how far off is a commute figure built the way a listing would build it, compared with the engine's door-to-door one-way commute over 30 days?

## The new script — `web/scripts/baseline-commute.mjs` (new file; `web/src/**` is read-only)

**Pure helpers.** Export these so the test can import them. Put the CLI code under `if (import.meta.url === pathToFileURL(process.argv[1]).href)`.
- `haversineM(lon1, lat1, lon2, lat2)`: metres, Earth radius 6371008.8.
- `listingWalkMin(distM, mPerMin)`: `Math.round(distM / mPerMin * 10) / 10`.
- `summarizeDiffs(rows)` → `{ n, excluded, mean, median, min, max, share_listing_lower }`:
  - only rows with a finite `diff_min` count;
  - `excluded` is how many rows have `diff_min === null`;
  - each statistic is rounded to 0.1;
  - `share_listing_lower` is the share of counted rows with `commute_listing_min < commute_engine_min`, rounded to 0.01;
  - `n` of 0 gives null statistics.
- `buildRow({ set, cand, home, stationLonLat, rideMin, engineValues })` → one row:
  - `{ set, id, name, station, straight_m, station_walk_listing_min, station_walk_listing_min_67, station_walk_graph_min, ride_min, commute_listing_min, commute_engine_min, engine_runs, diff_min, reason }`;
  - listing walk uses 80 m/min, with a 67 m/min sensitivity column;
  - `station_walk_graph_min = home.station.walk_minutes`;
  - `commute_listing_min = station_walk_listing_min + ride_min`, with no waits, no transfers and no last mile;
  - `commute_engine_min` is the mean of the finite `engineValues`, rounded to 0.1;
  - `diff_min = commute_engine_min − commute_listing_min`, rounded to 0.1;
  - any missing piece gives `null` for the affected values and a short `reason` string (`"no rail leg in the engine trip"`, `"station not in network"`, `"build_scenario failed: …"`). Never throw.

**CLI**: `node web/scripts/baseline-commute.mjs --data-dir <dir> [--scen-dir scenarios] [--out docs/evidence/baseline-commute.json]`
1. **Sets.** For every candidate in each list, never a subset: `web/public/recorded/<file>.json` → `candidatesData.result.candidates` (6 each). The household comes from the same file's `profile`.
   - `K1` = `seoul-couple.json`
   - `K2` = `pangyo-reviewed-month.json`
   - `U` = `menlo-month.json`
2. **Readers**, the same as `web/src/consult/server.js` with a local dir:
   - `read(root, rel)` = `readFile(join(root === "data" ? dataDir : scenDir, rel), "utf8")`.
   - Import the exported `createHomesLoader` and `createUsHomesLoader` from `../src/consult/server.js`.
   - Copy these loaders into the script; they are not exported:
     - `loadAreaFs` from `server.js:181-192`;
     - `loadAreaMetaFs` from `:195-201`;
     - `loadRegionFs` from `:205-218`;
     - `loadAreasIndex`, `loadStationBoxes` and `loadTransit` from `:395-416`. `loadTransit` uses `parseInterstationCsv`: look at server.js's import line for it and import it the same way.
3. **Session per set**, `createSession` and `callTool` from `../src/consult/tools.js` (see `tools.js:299-327` for the fields):
   ```js
   const session = createSession({ scenario: record.scenario, context: { profile: record.profile },
     loadArea, loadAreaMeta, loadRegion, loadHomes, loadUsHomes, loadAreasIndex, loadStationBoxes, loadTransit });
   ```
4. **Per candidate, single-home scenario.**
   - `const b = await callTool(session, "build_scenario", { profile: record.profile, home_ids: [cand.id] });`
   - If `!b.ok`: give the row `reason` and nulls, and go on.
   - The home record is `(await loadHomes()).homes.find(h => h.id === cand.id)`. Its `station = { station, walk_minutes }`.
5. **Ride.** In `session.scenario.household.members`, take the first member whose `work.type === "station_ride"`. Then `rideMin = rideMinutesForHome(member.work, "A")` (from `../src/engine/scenario.js:186`).
   - No such member, or `null` → reason `"no rail leg in the engine trip"`.
   - Use the station name `member.work.station_name.A` when it is an object, or the string itself.
6. **Station point.** `stationCoords(region.network, stationName)` (`../src/engine/workplace.js:37`) with `region = await loadRegion([homeArea])`. `null` → reason `"station not in network"`.
7. **Engine, 10 seeds.** For each `seed` of `defaultSeeds(session.scenario)` (`../src/engine/paired.js:28`):
   ```js
   session.scenario = { ...session.scenario, seed };
   const r = await callTool(session, "run_simulation", { home: "A", decisions: "rules" });
   const hit = r.ok ? session.cache.runs.get(r.run_ids.A) : null;
   engineValues.push(hit ? oneWayCommuteOfRun(hit.run) : null);   // ../src/verify/numbers.js:239
   if (hit) session.cache.runs.delete(r.run_ids.A);               // keep memory flat
   ```
   This is the same tool path and the same one-way number the app's compare card shows.
8. **Output JSON.** Sort keys with stable insertion order and add no timestamps, so two runs are byte-identical.
   ```json
   { "stage": "60a",
     "params": { "listing_m_per_min": 80, "sensitivity_m_per_min": 67, "engine_walk_m_per_min": 78,
                 "seeds": [..], "decider": "rules", "data_dir": "<basename of --data-dir>",
                 "sets": { "K1": "seoul-couple.json", "K2": "pangyo-reviewed-month.json", "U": "menlo-month.json" } },
     "rows": [..18 rows..],
     "summary": { "K1": {..}, "K2": {..}, "U": {..}, "K": {..K1+K2 rows..} } }
   ```
   Print one line per set: `<set> n=<n> mean=<mean> median=<median> min=<min> max=<max> listing_lower=<share> excluded=<excluded>`.

## Test — new `web/tests/baseline-commute-60a.test.js`
Use a 3-home fixture with plain objects, and do not run the CLI.
- `listingWalkMin(800, 80) === 10` and `listingWalkMin(670, 67) === 10`.
- `haversineM` between (127.0, 37.0) and (127.0, 37.01) is within 2 m of 1112.
- `buildRow` with `rideMin` 12, a straight distance of 400 m and `engineValues` [20, 22, null] gives:
  - `station_walk_listing_min` 5;
  - `commute_listing_min` 17;
  - `commute_engine_min` 21;
  - `diff_min` 4.
- A row with `rideMin` null has `diff_min` null and reason `no rail leg in the engine trip`.
- `summarizeDiffs` over two good rows and one null row gives `n` 2 and `excluded` 1.
- The same inputs to `summarizeDiffs` twice give `JSON.stringify`-equal results.

Run only: `cd web && node --test tests/baseline-commute-60a.test.js 2>&1 | tail -15`. Do not run the CLI; the orchestrator runs it with the data.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`web/src/**` (read only), `relay/*`, `README*`, `docs/*`.

## Final message
Changed files, one line each.
