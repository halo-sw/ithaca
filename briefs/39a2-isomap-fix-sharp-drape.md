# Stage 39a2 — isomap: fix the boot crash and drape a sharp photo for the shot (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 2 tool calls. Stop when the named tests pass.

## Live run (dev server, `?isomap=1&area=us-menlo&lon=-122.1561971&lat=37.4795456&span=240`)
- `PAGEERROR TypeError: object is not iterable` at `bootIsomap` (`web/src/main.js`, the `for (const m of built.crowdMeshes || [])` / `built.streetMeshes` loops): those fields are not arrays. `window.__isomap` stays `{ready:false}`, the script times out.
- The drape ran for the whole box: `[aerial] ok 110 tiles z15` — about 4.8 m per pixel, far too blurry for a 240 m shot.

## Changes
1. Make the hide step robust: hide crowd/street things whatever their shape (array, object of meshes, Group, single mesh) and never throw; wrap each hide in its own guard so one failure cannot stop the shot. Set `window.__isomap = { ready: true, ok: false, reason }` from a top-level catch in `bootIsomap`, so the script never waits 90 s on a crash.
2. Sharp drape for the shot only (normal 3D unchanged): in isomap mode, after the scene is built, drape again over the shot's ground bbox (span × 1.6 square around lon/lat) at the highest zoom the source has:
   - Korea: the existing `/api/tiles/Satellite` path at z18 (z19 if the tile answers), through the same mosaic code (`drapePlan`/`tilesForBBox`/`uvForLonLat`, `web/src/aerial/drape.js`, `tiles.js`).
   - US: one image from the USGS NAIP ImageServer (public domain, CORS `*`, checked): `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox=<w,s,e,n>&bboxSR=4326&imageSR=3857&size=2048,2048&format=jpg&f=image` (USGS imagery tiles stop at z16). Map it with the same lon/lat→UV convention (the bbox is the texture range; compute v from Web-Mercator y so it lines up with `uvForLonLat`). Credit `Imagery: USGS NAIP (public domain)`.
   - Apply to ground and roofs as the existing drape does; outside the bbox the old drape stays.
   - `window.__isomap.drape = { source, zoom|size, ok }`.

## Tests — extend `web/tests/isomap-39a.test.js`
- NAIP URL builder for a bbox (exact string) and its UV for the bbox corners/centre (0/1/0.5 within 1e-6, Mercator v).
- The tolerant hide helper on: an array, an object of meshes, a Group-like `{traverse}`, `null` — sets `visible=false`, never throws.
Keep green the 39a run line.

Run only:
```
cd web && node --test tests/isomap-39a.test.js $(ls tests/aerial*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each. Nothing else.
