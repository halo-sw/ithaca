# Stage 29N2a — US search covers the Caltrain corridor: one US region set, spread-out first page, Caltrain commute on cards, the Caltrain line on the map (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why
29N1 built US homes beyond Belle Haven: `data/build/homes/us-<area>.json` for `us-menlo` and seven Caltrain station boxes `us-st-san-francisco`, `us-st-belmont`, `us-st-san-carlos`, `us-st-redwood-city`, `us-st-palo-alto`, `us-st-mountain-view`, `us-st-sunnyvale` (each home: its own ZIP rent from Zillow ZORI, `station: {station, walk_minutes}`, and for station boxes a labelled `commute` block: `walk_to_station_min, caltrain_min, headway_min, last_mile{bike_min, walk_min, shuttle_min_assumed}, total_min`, sources `caltrain_gtfs` / `osm_graph` / `assumed`). Plus `data/build/region-us/network.json` (one `caltrain` line, same schema as the Seoul `region/network.json`) and `data/build/region-us/caltrain-am.json`. Open one file to see the real shapes before coding.
The app still says "a US search loads exactly us-menlo" in many places, so a Meta HQ search still shows six homes on one street.

## Changes
1. **One US region set.** In `web/src/places-us.js` export `US_REGION_IDS` (the eight ids above, `us-menlo` first) and keep `US_REGION_ID` as the HQ area. Every "exactly us-menlo" rule becomes "the US set": `web/src/ui/chat.jsx:~1994-2002`, `web/src/chat/engine.js:~176-185`, `web/src/consult/tools-search.js:~183-205` (`usRegionsForProfile`, `isUsProfile` also true for any `us-st-*`), `web/src/ui/agent-float.js:~241`, the notes in `web/src/consult/tools.js:~575-586` (say the US corridor areas and that each has a 3D box only where 29N2b adds it — leave the 3D part as today in this stage), `web/src/region-names.js` (English + Korean aliases: Redwood City/레드우드시티, San Carlos/샌카를로스, Belmont/벨몬트, Palo Alto/팔로알토, Mountain View/마운틴뷰, Sunnyvale/서니베일, San Francisco/샌프란시스코/SF, Belle Haven/벨헤이븐 → us-menlo). `createUsHomesLoader` (`web/src/consult/server.js:~144`) and the browser loader read every `homes/us-*.json` of the set and concatenate (missing files skipped).
2. **Ranking + a spread-out first page.** US homes sort by commute to Meta HQ: `commute.total_min` for station boxes; for `us-menlo` the existing walk/bike minutes. The first page (6) takes at most 2 homes per area, filling from the next-best area, so a first search spans Belle Haven + several towns; "Show more" continues in pure commute order. The budget filter uses each home's own ZIP rent. Keep the existing sources/labels.
3. **Cards (English + Korean).** A station-box home shows its commute as a breakdown built in code: `Caltrain 41 min · walk 6 + wait 10 + train 12 + bike 13` / `칼트레인 41분 · 걷기 6 + 대기 10 + 열차 12 + 자전거 13`, with the existing `Estimate` badge style where a part is assumed; a second line `or Meta shuttle from Menlo Park Stn (assumed)` / `또는 멘로파크역에서 메타 셔틀(가정)`. The area name shows on the card (`Palo Alto`, `Redwood City` …; Korean: 팔로알토…). Belle Haven homes keep today's walk/bike text.
4. **Map.** When US candidates are shown: draw the Caltrain line from `region-us/network.json` (Caltrain red `#E31837`, same line layer as Seoul subway lines) with station dots and our station labels (`Palo Alto Stn`; the USGS basemap prints none), the workplace pill as today. Rents now differ by ZIP, so `sharedZipRent` turns off by itself and pins show prices (`$3,950`). The fit covers all shown pins + HQ (29M2 pipeline).
5. **Consult agent text.** `find_homes` results for US carry `area_label`, `commute_breakdown` and `zip`/`rent_source`, so Muse can say "Palo Alto (Caltrain ~41 min door to door)". In `ENGLISH_NOTE`/the Korean system text, add one line: US commute via Caltrain is a timetable-based estimate; the Meta shuttle is an assumption, never a fact.

## Tests — new `web/tests/us-corridor-29N2a.test.js`
- `usRegionsForProfile` for a USD profile returns all eight ids; `isUsProfile` true for `["us-st-palo-alto"]`.
- The US loader with a fake `read` concatenates two area files and skips a missing one.
- Ranking/spread: 12 fake homes over 4 areas (3 each) → first page of 6 has ≤ 2 per area and is commute-sorted within that rule; page 2 is pure commute order.
- Card text helpers: English `Caltrain 41 min · walk 6 + wait 10 + train 12 + bike 13` and the shuttle line with `(assumed)`; Korean `칼트레인 41분 · 걷기 6 + 대기 10 + 열차 12 + 자전거 13`.
- SSR `ChatMap` with two US pins from different ZIPs: a Caltrain line path with stroke `#E31837`, a `Palo Alto Stn` label, pins with prices (no shared-rent legend note).
Keep green: `tests/map-frame-29M2.test.js`, `tests/pins-commute-29k2.test.js`, `tests/home-names-29M1.test.js`, and every test that pins the US/menlo rule (`grep -l "us-menlo" tests/*.test.js`) — update a pinned expectation only where it pinned "exactly us-menlo", and list it in the final message.

Run only:
```
cd web && node --test tests/us-corridor-29N2a.test.js tests/map-frame-29M2.test.js tests/pins-commute-29k2.test.js tests/home-names-29M1.test.js $(grep -l "us-menlo" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
The 30-day engine / 3D for station boxes (stage 29N2b), `pipeline/`, `data/`, `briefs/`.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.
