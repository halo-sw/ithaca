# Stage 38c — "Walk on the map": the same 30-day run, followed on a flat map instead of 3D (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass. Parallel runs are editing `web/src/engine/**`, `web/src/profile.js`, `web/src/verify/**` and `scenarios/**`; do not touch those.

## Why
The user asked for a way to walk the month without 3D.
- Phones and weak GPUs struggle with the 3D scene, and some people just want to see the route.
- Today every moment opens the 3D iframe (`SceneFrame`, `web/src/ui/chat.jsx:3755-3830`), and there is no 2D view of a run.
- `web/src/mapsim.js` has pure helpers (`mapRoutePolylines`, `fitRouteViewport`) that nothing uses yet.

## Data you can rely on (no new data files)
- **Scene URL.** A run scene's URL carries `custom=<id>`, `home=<A|B>` and `day=<n>`. Find the exact param names where moment rows build the URL (`grep -n "custom=" web/src/ui/chat.jsx` once).
- **Saved run.** `loadCustomRun(id)` (`web/src/chat/idb.js:78`) → `{ scenario, runs, labels, names, … }`.
  - `runs` is per home label. Each run has `trips` (`agent`, `day`, `depart_min`, `arrive_min`, `purpose`, `path` = walk-graph node ids, `graph_area` when the leg is on another box, `remote`) and `aways` (`agent`, `day`, `start_min`, `end_min`, `kind`, `label`, `detail`; ride aways carry station names in `detail`).
  - Household members are the agents that are not background (`householdMembers` in `web/src/verify/numbers.js`).
- **Area.** `loadBoxArea(fetchJson, areaId)` (`web/src/chat/engine.js:244-255`) with the `fetchDataJson` helper from `web/src/data-fetch.js`. The area's `graph.nodes` is `{ "<nodeId>": [lon, lat] }`. The home area is `scenario.homes[i].area` for the label; a trip with `graph_area` uses that area's graph.
- **Network.** `data/region/network.json` (via `assetUrl`) gives station coordinates (`lines[].stops`). `findPath(network, from, to, 2.0)` (`web/src/engine/journey.js:98`) gives the station chain for a ride.
- **Map base and fit.** Reuse what the chat map already uses: the VWorld `white` tiles and `fitMapView` (`web/src/chatmap.js:184`), and the tile list/underlay code in `web/src/ui/chatmap.jsx:540-570` with its SVG at `:834`. Import the helpers; do not copy the ChatMap component. Credit line: the same VWorld/OSM credit text ChatMap shows.

## Change
1. **New `web/src/mapwalk.js`** (pure, tested):
   - **`dayTimeline(run, { day, agents, nodeCoordsFor, stationCoord, network })`** → a time-ordered list of segments, each `{ t0, t1, kind: "walk"|"ride"|"stay", pts: [[lon,lat],…], label }`, for the household members on `day`.
     - Walk segments come from `trips` (path ids → coords; ids with no coord are dropped).
     - Ride segments come from ride aways: stations along `findPath`, mapped to coords.
     - Stay segments come from the other aways (one point, the end of the previous walk).
     - Overlapping members: the first household member (the one the moment is about) is primary; other members are returned in `others`.
   - **`positionAt(segments, minute)`** → `{ lon, lat, seg }`, interpolated along `pts` by time (linear by cumulative distance).
   - **`activityLine(seg, minute, lang)`:**
     - walk: `08:04 · 걷는 중 · 미금역까지` / `08:04 · Walking · to Migeum Stn`;
     - ride: `08:10 · 신분당선` / `08:10 · Shinbundang Line`;
     - stay: `09:00 · 판교 직장` (use the away `label`).
     - Times as `HH:MM`. The English form goes through `romanize`/existing name helpers; no new numbers.
2. **New `web/src/ui/mapwalk.jsx` `MapWalk({ url, lang, phone, runReady })`:**
   - Parses the scene URL and waits on `runReady` the way `SceneFrame` does (`:3757-3772`).
   - Loads the run, the area(s) and the network once.
   - Renders an SVG map that fits all of that day's segments (`fitMapView`) over the VWorld tile underlay:
     - walk = solid, ride = line colour from `lineColorFor`, others = thin grey;
     - home pin `A`/`B`, the workplace square as ChatMap draws it, and a moving dot for the primary member.
   - **Controls under the map:** play/pause, a time slider for the day (from the first segment's `t0` to the last `t1`), and `Day n` back/next buttons that change `day` within 1..`scenario.days`. Below them, the `activityLine`.
   - **Playback:** 1 sim-minute per 100 ms. Pause at the end.
   - Missing run → `저장된 살아 보기를 찾지 못했어요.` / `Couldn't find the saved run.`. A missing area just skips walk shapes for that leg.
   - Layout works at 390 px: map on top, controls in one row, all text ≥ 14px, no `text-overflow`.
3. **`SceneFrame` toggle** (`web/src/ui/chat.jsx:3755-3830`).
   - When `scene.url` has a `custom=` param, show a two-option segmented control in the header: `3D` | `지도` (English `3D` | `Map`).
   - Default `3D`. Remember the choice for the session (`sessionStorage` key `ithaca.sceneMode`, read/write in try/catch).
   - `지도` renders `<MapWalk url={scene.url} lang phone runReady />` instead of the iframe. "Open in new window" stays for 3D only (hide it in map mode).
   - Tours without `custom=` (the neighbourhood tour) keep only the iframe.

## Tests — new `web/tests/mapwalk-38c.test.js`
- **`dayTimeline` on a synthetic run.** Graph nodes `n1..n4`. One walk trip day 2 07:50–08:00 over `n1,n2,n3`; a ride away 08:00–08:20 with stations 미금→판교 (a 2-stop network fixture); a work away 08:20–18:00.
  - Result: segments walk → ride → stay, in order. Walk `pts` has 3 coords; ride `pts` starts at 미금 and ends at 판교.
  - Trips of a background agent `b01` are ignored.
- **`positionAt`:** at 07:55, halfway along the walk by distance. At 12:00, the stay point.
- **`activityLine`:** Korean and English strings for each kind, matching the formats above, with no Hangul in English.
- **SSR:**
  - `SceneFrame` with a `custom=` url renders the `3D` and `지도` options; without `custom=` it does not.
  - `MapWalk` with `runReady` pending renders the waiting line and no `<svg`.
- **Keep green:** web tests matching `SceneFrame|replay|mapsim`.

Run only:
```
cd web && node --test tests/mapwalk-38c.test.js $(grep -lE "SceneFrame|replay|mapsim" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/profile.js`, `web/src/verify/**`, `scenarios/**`, `web/src/i18n/**`, `web/src/main.js`, `web/src/consult/**`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
