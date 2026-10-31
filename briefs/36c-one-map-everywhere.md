# Stage 36c — one map everywhere: the aerial photo covers every 3D scene and the ride corridor, like 잠실 (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer (2026-11-01): "지도 이미지가 각각 다르잖아. … 지도 데이터를 제대로 일관되게 매핑해줬으면 좋겠어." They name 잠실 as the model.

The orchestrator captured the same day on four surfaces (`briefs/img/fid-gangnam-surfaces.jpg`, `fid-jamsil-aerial.jpg`, `fid-pangyo-aerial-edge.jpg`):
- **잠실 and the 강남 station box:** the VWorld aerial photo is draped on the ground and roofs. This looks like the real city.
- **판교:** the drape covers only about 1.3 km (`area.bbox`, z18, 121 tiles). Buildings outside it stand on beige.
- **The ride corridor between stations** (`journey-scene.js` base map): a flat land-coloured plane under untextured blocks, labelled `간략 지도 (건물 높이 추정)`.
- **The aerial credit** (`ui/app.jsx:1005-1016` `SimCredit`) shows whenever `state.aerial` is true, including over the beige corridor where no photo is visible.

The coordinate transform is already shared (lon/lat → Web Mercator, `aerial/tiles.js` `uvForLonLat`), and the captures show no offset. Only the coverage is inconsistent.

## Change
1. **Drape the whole scene, not the bbox** (`web/src/aerial/drape.js:79-112`).
   - Add an optional `bounds` argument (`[w, s, e, n]`). When it is absent, use the scene's buffered extent: the bbox of all ground/terrain mesh vertices, or of the area's buildings and roads if that is simpler from the args you already have. Never smaller than `area.bbox`.
   - Keep the zoom rule: `pickZoom` on the width, then step down while the mosaic exceeds `MAX_MOSAIC_PX` (`:104-112`).
   - UVs keep using `uvForLonLat` with the new range.
2. **Drape the ride corridor** (`web/src/journey-scene.js`).
   - The corridor base map is a land-coloured plane over the manifest bounds (`:150-175`, `buildBaseMap`/`baseMapBounds`).
   - Give the layer a `drapeCorridor(drapeFn)` hook. When a manifest is set (`setManifest`, `:448-457`), call it with `bounds = manifest.bounds`, so the plane gets the aerial mosaic as its map. It uses the same tile source and the same zoom/step-down rule (about z15 for a 7 × 13 km corridor), on the same `drapeAerial` code path or a small shared helper. Do not duplicate the tile fetch loop.
   - Corridor block roofs may stay untextured.
   - **Painted fallback.** If the drape fails (no key, static build, US), the plane stays as today.
   - **Wiring.** In `main.js` (the corridor block, `:2573-2630`, and where `setManifest` is called, `:2839-2845`), pass the hook. Publish `store.set({ aerialCorridor: true })` when it succeeds and `false` when the manifest changes.
3. **The credit follows the photo** (`ui/app.jsx:1005-1016`).
   - Show the aerial part only when the photo the camera is looking at is draped:
     - outside a ride: `state.aerial`;
     - during a ride, when the corridor ground is visible: `state.aerialCorridor`.
   - The journey state (`state.journey` set in `main.js:3087-3112`) tells you which.
   - The `corridorLabel` `간략 지도 (건물 높이 추정)` stays (heights are still estimated).
4. **One ground colour token.** The painted ground (`LOOK.regionalGround`, `main.js:2592-2601`) and the corridor plane's colour come from the same look key. When no photo loads anywhere, the station scene and the corridor meet without a colour seam. If they already share the key, leave it.
5. **Remove dead code.** Delete `web/src/ui/mapsim-view.jsx` (imported nowhere; it has `fontSize="13"` and hard-coded colours). Check with `grep -rn "mapsim-view" web/src web/tests` first. If a test imports it, delete that test case too and name it.

## Test — new `web/tests/one-map-36c.test.js` (pure helpers, no DOM / WebGL)
- **Bounds:** factor the bounds → zoom → tile-range choice into an exported pure function, e.g. `drapePlan(bounds)` → `{ zoom, range }`.
  - The 판교 scene extent (4 km wide) steps down from 18 until the mosaic is ≤ 4096 px per side.
  - The corridor `c1` bounds `[127.027608, 37.394364, 127.111157, 37.513716]` give zoom ≤ 15 and ≤ 4096 px per side.
  - A 1.2 km box keeps z18.
  - The range contains every corner of the bounds.
- **Corridor hook:** `createJourneyLayer(...).setManifest(m)` with a fake `drapeCorridor` hook calls it once with `m.bounds`, and not again for the same manifest id.
- **Credit:** render `SimCredit` (SSR):
  - `{ aerial: true, journey: { corridorLabel: … }, aerialCorridor: false }` → no `VWorld`;
  - `{ aerial: true, journey: null }` → `VWorld` present;
  - `{ aerial: true, journey: {…}, aerialCorridor: true }` → present.
- **Gone:** `mapsim-view.jsx` does not exist.
- **Keep green:** every test that mentions `drapeAerial`, `aerial/`, `journey-scene`, `SimCredit` or `sim-credit`.

Run only:
```
cd web && node --test tests/one-map-36c.test.js $(grep -lE "drapeAerial|aerial/|journey-scene|SimCredit|sim-credit|mapsim" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/engine/**`, `src/money/**`, `relay/**`, `data/`, `README*`, `scenarios/`.

## Final message
Changed files, one line each. Deleted files. Nothing else.
