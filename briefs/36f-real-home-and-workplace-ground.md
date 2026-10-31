# Stage 36f — the officetel home is the officetel, the workplace scene has ground and photo, one tag per real part, the phone toolbar fits (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; 36e–36e4 are committed and the suite is green (2805/2807). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium, new demo, 2026-11-01)
1. **B lives in the wrong building** (`briefs/img/fid-b-wrong-building.jpg`, `fid-phone-b-en.jpg`). The label reads `우리 집 · 까치마을건영빌라 503동`; the run's `meta.home_building` is `w481224170`.
   - The scenario gives B lon/lat `127.1082913, 37.3493344`. The point lies **inside** `w465862686` 분당엠코헤리츠오피스텔 (12 floors, 2,797 ㎡), 7 m from its centroid.
   - The lon/lat branch of `resolveHome` (`web/src/engine/scenario.js:~581-600`) sorts `residential !== "none"` first. The officetel is registered as `업무시설`, so it has `residential: "none"` and loses to an apartment farther away.
2. **The workplace scene has no ground** (`fid-pangyo-dest-black.jpg`, A at 08:18 and 08:32 at work in 판교). White untextured roofs over black, credit `© OpenStreetMap` only. The 판교 detail is loaded as a second area (`main.js:2849-2850` `ensureSecondArea`). That path builds buildings but not the terrain/ground meshes or the aerial drape the home area gets (`main.js:298-330`, `:446`).
3. **Two tags on one part.** B (no transfer) shows `걷기 2분 측정 + 지하철 7분 가정값 가정값` on desktop. On the phone it shows `+ 7 min … assumed subway assumed`. A part with 0 minutes, or the empty transfer part, still renders a tag (36d `parts`, `evidence.js` / the `app.jsx` renderer).
4. **Phone toolbar clipped.** At 390 px in English the top toolbar ends in `Follo` (cut). Rule: no clipping and no ellipsis. Let the toolbar wrap to two rows, or shorten nothing and drop the gap. Korean must stay one row if it fits.

## Change
1. **`resolveHome`, lon/lat branch:**
   - **Contains first.** A building whose footprint contains the point wins, whatever its residential flag (pure point-in-polygon on `geometry`, first ring).
   - **Fallback.** Else keep today's ordering, but treat `residential: "none"` with `register` 업무시설 + `building: apartments`, or a name containing `오피스텔`, as a dwelling candidate.
   - **Anchor.** Record `anchor.method: "point-in-footprint" | "nearest"`.
   - **Data.** The orchestrator regenerates the sim data afterwards. Do not edit `data/`.
2. **Second-area ground** (`ensureSecondArea` and what it calls):
   - **Ground.** The workplace/destination area gets the same scene ground as a home area: terrain from its `scene.json` when present, the merged ground layer, the fringe plane.
   - **Drape.** Give it the same `drapeAerial` call, its own mosaic and bounds. Keep the 4096 px cap; each area drapes once and is cached by area id.
   - **Credit.** Apply the 36c rule to `SimCredit`: the VWorld credit shows when the camera's area is draped.
   - **No duplication.** Factor the home-area ground + drape block into one function used by both paths.
3. **Tags only on real parts** (`evidence.js` parts and their renderer):
   - Drop parts with 0 minutes or no label.
   - Render exactly one tag per part.
   - B's line becomes `걷기 2분 측정 + 지하철 7분 가정값`.
4. **Phone toolbar:** fit at 390 px in English without clipping (wrap allowed), and keep tap targets ≥ 44 px.

## Test — new `web/tests/home-and-dest-36f.test.js`
- **Contains:** a fake area where point P is inside a 업무시설 building (`residential: "none"`) and a residential building is 40 m away. `resolveHome` returns the containing one, `anchor.method === "point-in-footprint"`.
- **Real data** (skip if `data/build/st-미금/area.json` is missing): the demo B → `w465862686`.
- **Ground:** the factored ground+drape function is called for a second area (spy on the injected drape fn, as in `one-map-36c`), once per area id.
- **Parts:** a B-like run (walk + one ride, no transfer) gives exactly 2 parts and 2 tags in the rendered line (SSR).
- **Toolbar:** at 390 px in English, no toolbar button's text is clipped. Use the existing layout/CSS test pattern (`grep -l "390" web/tests/*.test.js`); else assert the CSS allows wrapping.
- **Keep green:** `honest-parts-36d`, `one-map-36c`, `fringe-roofs-36c2`, `affordable-demo-36e`, `engine-workplace`, and every test that mentions `resolveHome`, `ensureSecondArea`, `SimCredit` or `parts`.

Run only:
```
cd web && node --test tests/home-and-dest-36f.test.js tests/honest-parts-36d.test.js tests/one-map-36c.test.js tests/fringe-roofs-36c2.test.js tests/affordable-demo-36e.test.js tests/engine-workplace.test.js $(grep -lE "resolveHome|ensureSecondArea|SimCredit|\.parts" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
Tests that read the demo sim data and pin B's building may change once the orchestrator regenerates; list them, do not edit them. If anything else still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `README*`, `scenarios/`, `pipeline/**`, `public/recorded/**`.

## Final message
Changed files, one line each. Tests that wait for regenerated data. Nothing else.
