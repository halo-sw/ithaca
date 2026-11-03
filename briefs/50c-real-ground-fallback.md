# 50c — Real neighborhood geometry beneath candidate map imagery

Muse writes all product code/tests. Implement ONLY the small ground-data module + integration below. No exploration/git/build/full suite. Read only listed ranges. Max 28 steps. Existing 50a/b changes must remain.

## Proven need

Live tile requests began timing out during orchestrator QA; the existing fallback is also inadequate: chat.jsx loads first 24 intersecting tiles of one c1 corridor, giving a few roads near Gangnam but almost nothing across the rest of Jamsil/US. Actual area data IS deployed: public `/data/st-잠실/area.json.gz` and `area.buildings.json.gz` HTTP200, 1,506 real building footprints. We must reuse real geography, not decorate with guessed blocks. No relay/auth/key/quotas changes.

## Existing code / exact reads

- `web/src/ui/chat.jsx:90-105,3275-3305,5388-5412,5820-5843`: imports, candidate map loading effect, resolved workplace shape, buildChatMap call. Do not read full 6k-line file.
- `web/src/chatmap.js:373-378,468-500`: buildChatMap signature/output. Add optional `ground` field passthrough, default empty.
- `web/src/ui/chatmap.jsx:1-30,555-578,970-1048,934-980` (line positions may shift slightly; use rg for ground rect/creditFull if needed): insert base layer just after map-ground rect, before existing vectors/raster.
- `web/src/paths.js:1-40`, `web/src/data-fetch.js` whole small: fetchDataJson auto-decompresses st-/hm- box JSON in prod. Use injected fetchJson already in chat.jsx. Do NOT call loadBoxArea: it loads graph/simulation data we do not need.
- `web/src/ui/ui.css:1013-1022,1030-1052,1083-1110,1155-1190`: current icon buttons are fixed40x40; Retry text needs own auto-width with normal horizontal padding, minimum40px height. Status text should fit/wrap on phone and use existing 12px/spacing tokens.

## Data contract (verified from real files; no need read huge files)

Candidate `.scene` is a real area ID: KR `st-석촌`, `st-강남`, `st-판교`, etc.; US `us-menlo`, `us-st-palo-alto`, etc. Profile `.workplaces.value[]` `.resolved.station` e.g. `잠실` / `판교` maps to `st-${station}`; US `.resolved.region`=`us-menlo`. Collect unique valid IDs, workplace then picked candidates then remaining candidates, cap8, no arbitrary pathname/traversal.

`/data/<areaId>/area.json` contains roads, buildings, landuse. Each is an array OR a single `{$ref:'area.roads.json'}`/`{$ref:'area.buildings.json'}`. Only load these three sections, validate section ref is a basename ending .json, no path/network refs. Do NOT load graph, trees, POIs. Area JSON may be missing: keep the other successful areas.

Real geometries are WGS84 lon/lat, NOT local XY. Example road:
`{id:'w1004692936',highway:'footway',geometry:{type:'LineString',coordinates:[[127.1030985,37.5101494],[127.1032874,37.5099475]]}}`
Landuse `{id:'w...',kind:'natural:water'|'leisure:park'|'landuse:grass'|'landuse:forest'|...,geometry:Polygon|MultiPolygon}`. Only explicit water/green kinds become water/parks; commercial/residential etc must NOT become parks. Polygon rings can contain holes; preserve holes using SVG paths fillRule=evenodd.
Building `{id:'reg:...',origin:'register'|'osm',geometry:Polygon|MultiPolygon}`. Deduplicate overlapping areas by source/id (roads and landuse OSM IDs consistent); fallback geometry key if id absent. Keep finite valid lon/lat geometry only; no invented geometry. Precompute feature bbox once in conversion.

## Implementation

1. Add small `web/src/map-ground.js` module: area ID selection, lightweight async loader (bounded concurrency3; bounded promise cache12 areas; failed loads not cached forever), geometry normalization/dedup, viewport projection into combined SVG path strings by type. Export pure helpers for tests. Catch failed referenced section independently so roads survive a failed building file. Output loaded area IDs/source attribution flags alongside features.
2. Update existing chat.jsx candidate-map effect to load corridor + new map ground, clear stale ground immediately when query changes, ignore late previous search results. Dependencies include stable workplace IDs/picks as needed. Add mapGround state, pass through buildChatMap. Preserve all existing candidate/scenario/simulation behavior.
3. Render one combined SVG path per layer (water, parks, buildings, major/minor roads) beneath raster, same MAP_COLORS palette. Clip using current lon/lat viewport bbox before projecting. Only render building footprints at neighborhood scale (effective metersPerPx <=8), never 17k building DOM nodes. Use projected paths evenodd for holes. Real roads/parks/water remain visible while pending or absent raster. Aerial/3D code untouched. Full map does not imply geometry outside the loaded areas: do not claim complete coverage.
4. Fallback attribution includes OSM; when visible loaded ground includes national register footprints, mention MOLIT building register (English/Korean) in full credit. No fake VWorld credit before imagery loads. Keep current successful imagery credits.
5. Fix Retry spacing: `.ui-chatmap-side > .ui-chatmap-retry` auto width, horizontal padding12, min-height40; status 12px, max-width clamp within phone viewport, wrapping. Keep controls within existing measured side column, no new top overlay. All user-facing text localized/no-i18n.

## Tests

Add `web/tests/map-ground-50c.test.js`: Jamsil station workplace + scene IDs selected; Pangyo and US IDs; invalid IDs/refs not fetched; loader resolves only roads/buildings/landuse (never graph), partial section failure preserves roads; dedup overlapping boxes; Polygon hole/MultiPolygon preserved; water/park kinds correct, invalid numbers ignored; viewport excludes distant features, buildings omitted at wide scale but shown close up. Test bounded requests/failed retry cache if implemented. No need source-mirror tests for CSS.

Run only `node --test web/tests/map-ground-50c.test.js web/tests/basemap-50a.test.js web/tests/chatmap-26o.test.js 2>&1 | tail -20`, stop after max2 fix attempts. Orchestrator handles browser regression/build/full suite and public deployment.
