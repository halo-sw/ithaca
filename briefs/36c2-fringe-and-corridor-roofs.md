# Stage 36c2 — the photo reaches the scene edge, and corridor roofs get the photo too (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 36c is committed. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium after 36c, `?area=pangyo&time=10:00`)
1. **판교 edge still beige.** After 36c, 판교 still shows beige ground under the outer ring of buildings, even though the mosaic grew from z18/121 tiles to z17/72 tiles.
   - The beige is the base fringe plane: `web/src/main.js:298-309`, `base = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.5, span * 1.5), MeshStandardMaterial({ color: baseDayColor }))`.
   - It is never passed to `drapeAerial` (`main.js:446-447` passes only `terrainMesh, groundMesh, roadMeshes, roofMesh`).
   - `sceneDrapeBounds` (`aerial/drape.js:122-133`) measures only those meshes.
2. **Corridor roofs untextured.** During a ride the corridor ground is now the photo, but the corridor's blocks are untextured white on top. In the station scenes the roofs get the photo, which reads as real.
3. **Beige inside the scene, not only at the edge** (`?area=st-송파나루&time=10:00` → `briefs/img/fid-songpanaru-beige.jpg`; `?area=songpa-jamsil` upper left → `fid-jamsil-beige.jpg`; `?area=st-미금` is fully photo → `fid-migeum-aerial.jpg`). Console says `[aerial] ok 72 tiles z17` on all three. In 송파나루 the whole ground of the 효성올림픽카운티 / 더샵스타리버 blocks is flat beige with the photo only on roofs. Same on part of 잠실.

## Change
1. **Drape the base fringe plane** (`main.js:298-309`, `:446-447`; `aerial/drape.js`):
   - Pass `base` to `drapeAerial` as `fringeMesh`, and include it in `sceneDrapeBounds`. Keep the 4096 px cap and the zoom step-down.
   - Give it UVs from its vertices' lon/lat with `uvForLonLat`, the same way the ground gets them.
   - Its material gets the mosaic `map`; colour white so the photo shows true. Where the mosaic has no tile, the canvas keeps the painted colour, as today.
   - On `?ground=paint`, or when the drape fails, the plane keeps today's colour.
2. **Corridor roofs** (`web/src/journey-scene.js`):
   - **Split.** When a corridor tile's soup geometry is built (`soupGeometry`, `:33-40`, and where tiles are added), split triangles into two groups:
     - roof: face normal y > 0.9;
     - wall: the rest.
   - **Roof UVs.** Roof vertices get UVs from lon/lat over the corridor mosaic range.
   - **Materials.** Use a two-material array: roofs share the corridor's aerial texture (set by the 36c `drapeCorridor` result), walls keep today's material.
   - **Fallback.** Without a corridor drape, roofs keep the wall material, exactly as today.
   - The draw call count per tile may grow by one at most.
   - Store the corridor mosaic `{ texture, range, zoom }` on the layer when the 36c hook succeeds, so tiles loaded later use it too.

3. **Find and drape the beige surface inside the scene.** Trace from code which mesh draws there after a successful drape. Candidates:
   - the complex ground plates (`src/ground.js` header: "complex plates 0.06") or `landuse` polygons inside `groundMesh`;
   - a terrain-mask area whose vertex colour multiplies the map;
   - the base plane showing through a gap in `terrainMesh`.

   The fix: after a successful drape, that surface shows the photo like the rest of the ground. With `?ground=paint` it keeps today's colour. Name the cause in the final message.
4. **Name glyph.** The 송파나루 card and the search list show `더?스타리버`.
   - **Cause.** The source is the transaction data itself: `data/build/homes/songpa-gu.json` has `home-012670` officetel `'더?스타리버'`, and `home-012679` apartment `'더샵스타리버'` at the same lon/lat. The raw name lost one glyph.
   - **Fix** (`pipeline/homes.py`, where names are set):
     - If a name contains `?` and another home within 30 m has a name matching it with `?` as one wildcard character, take that name.
     - Else drop the `?` and set `name_note: "원본 이름의 글자 하나가 깨져 있어요"`.
   - **Web side.** Apply the same rule where `area.complexes` names are rendered (the scene card), as a pure helper. The orchestrator rebuilds homes.

## Test — new `web/tests/fringe-roofs-36c2.test.js` (pure helpers, no WebGL)
- **Fringe:** `sceneDrapeBounds` with a fake fringe mesh larger than the terrain returns bounds that contain the fringe corners.
- **Split:** factor the roof/wall split into a pure function, e.g. `splitRoofWall(positions)` → `{ roofIdx, wallIdx }`. A unit cube's top face goes to roof and its 4 sides to wall. A flat-topped prism keeps all top triangles.
- **Roof UVs:** `roofUv(lonlat, range, zoom)` equals `uvForLonLat` for the same inputs.
- **Beige:** a pure check for the cause you found (e.g. the drape applies to the plates/landuse geometry, or `vertexColors` is off when a map is set).
- **Name:** `'더?스타리버'` next to `'더샵스타리버'` → `'더샵스타리버'`; alone → `'더스타리버'` with the note; Hangul-only names unchanged (pytest for the pipeline helper, node test for the web helper).
- **Keep green:** `tests/one-map-36c.test.js` and every test that mentions `journey-scene` or `drapeAerial`.

Run only:
```
cd web && node --test tests/fringe-roofs-36c2.test.js tests/one-map-36c.test.js $(grep -lE "journey-scene|drapeAerial" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
and `.venv/bin/pytest -q tests/ -k "name or homes" 2>&1 | tail -5` for the pipeline helper.
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/engine/**`, `src/money/**`, `src/profile.js`, `src/evidence.js`, `src/ui/candidate-card.jsx` (36d owns those), `relay/**`, `data/`, `README*`, `scenarios/`.

## Final message
Changed files, one line each. Nothing else.
