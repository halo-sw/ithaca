# 45c2 — Implement reliable aerial maps

Muse authors product code/tests per AGENTS.md. IMPLEMENT now, first edit within2 tool calls after one batched read. No planning-only answer. No other briefs/subagents/git/network/full suite/build. One part: aerial application and cache. Preserve current scene work.

Read only `web/src/aerial/drape.js:100–124,188–240,240–355`; `web/src/area-ground.js` (40lines). Apply all changes in one edit pass.

1. In drapePlan, US zoom cap becomes16 instead of18; export a named limit16. Real Chrome us-st-palo-alto: 72 z17 tiles all404. USGS service's maxScale is9027.977411, corresponding to16, despite generic lods array through23. Official source checked by orchestrator: https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer?f=pjson . Menlo wide z15 succeeds. Korean zoom selection and4096 cap unchanged. Isomap sharp NAIP export unaffected. This also completes brief45d (do not open it).
2. Both drapeAerial and drapeCorridorAerial: immediately after fetchMosaic, if drawn===0 return {ok:false,reason:'no-tiles'} before creating textures or touching any mesh/material. Retain existing vector land mask/roads/water on failure. Partial success behavior unchanged.
3. drapeAreaOnce cache: concurrent calls for same area+same actual target share promise; a new scene/fringe/ground mesh target with the same area ID must drape again, not reuse the old scene result. Calls without mesh targets (existing unit spies) may retain area-only identity. Failed/null/rejected entries are removed to permit a later retry. Removal must not delete a newer target's promise. Successful onOk stays tied to its target.

New `web/tests/aerial-reliability-45c.test.js`:
- SmallUSbbox≤16, equivalentKRbbox18; largeUSmosaic≤4096 andcontainscorners.
- All fetches fail in both drape functions: old material maps and vertexColors untouched, no THREE texture constructed, result reason no-tiles. Stub document canvas with fillRect only, stub fetch to !ok, use US bbox to avoid statuscheck. Restore globals after test. No network.
- Concurrent same target one call; failed target canretry; rebuilt mesh target sameID getsfreshdrape; oldfailurecannotclearnewtarget.
Run only new tests + aerial-20d.test.js, us-26e.test.js, one-map-36c.test.js, home-and-dest-36f.test.js. At most2 fixes. Final files+test counts; no commit.
