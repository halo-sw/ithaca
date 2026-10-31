# Stage 29L1 — The 3D scene reads at a glance: the route stays on the street, beacons only at night, dusk you can see, the person you follow is never hidden (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep to find the rest). Stop when the named tests pass.

## Why
Orchestrator captures, 2026-11-01 (real GPU, desktop 1440×900 and phone 390×844, Korean and English, `?mode=sim&home=A&day=3&t=08:20&follow=1` and the in-chat scene at 1일차 18:17 in 역삼):
1. **The blue route cuts through towers.** `routeAheadMat` / `routeDoneMat` are `depthTest: false` (`web/src/main.js:1579-1582`), so the line paints over every building between the camera and the street — in 잠실 it runs straight across 30-storey blocks.
2. **Red squares on rooftops all day.** The 14e aviation beacons (`main.js:599-640`, `needsAviationLight` / `aviationBlink` in `web/src/render/facades.js:219-228`) show at 08:20 in daylight and read as noise on every tall roof.
3. **Dusk is a black slab.** At 18:17–18:40 in November the blocks, roads and ground are near the same dark slate; you cannot tell one building from the next, and the route and people are the only things you can read.
4. **The followed person disappears.** With `follow=1` the camera sits low behind tall blocks: in 잠실 at 08:20 `나` is a tiny label between towers and the ring under it is hidden; in 역삼 the household chips sit on top of building labels.

## Changes
1. **Route on the street (`main.js:~1577-1600`).** Draw the route twice: the visible pass with `depthTest: true` (opacity as now), and an "occluded" pass with `depthTest: false`, the same geometry, opacity ≤ 0.25 and `dashed: true` (LineMaterial supports `dashed`, `dashSize`, `gapSize`; call `computeLineDistances()` on the geometry). Keep the route a hair above the ground (lift ≤ 0.6 m over `heightAt`) so it is not z-fighting the road. Same for the walked (grey) part.
2. **Beacons only after dark.** Show the aviation Points only when the scene is past sunset or before sunrise (reuse the same sunset/sunrise source the sky/lighting already uses — grep `sunset` in `web/src/render/sky.js` / `web/src/render/look.js` / `main.js`); hidden in daylight. Keep the blink. Keep `AVIATION_MIN_M`.
3. **A readable dusk.** In the night/dusk look (grep the night palette in `web/src/render/look.js` / `sky.js`), raise ambient/hemisphere light and the ground/road tone so that, at 18:30, building walls, roofs, roads and ground are four distinct tones (roofs lighter than walls, roads lighter than ground). Lit windows and street lamps stay. Do not touch the day look.
4. **Follow without losing the person (`main.js:~1990-2070` follow state, camera rig in `web/src/render/rig.js`).** When following, each frame raycast from the camera to the followed agent's head point against the building meshes; if a building blocks it, raise the camera's pitch/height (eased over ~0.4 s, clamped to a top-down limit) until the line of sight is clear, and ease back when clear. Make the followed person's ground ring at least 2× its current radius in screen space and in that household member's colour, drawn on top (it already uses `depthTest: false`).

## Tests — new `web/tests/scene-29L1.test.js` (pure helpers only; no WebGL)
Export small pure helpers and test them:
- `routeMaterialsFor()` (or the helper you add) returns a visible material with `depthTest: true` and an occluded one with `depthTest: false`, `dashed: true`, `opacity <= 0.25`.
- `beaconsVisible(minuteOfDay, sunsetMin, sunriseMin)` → false at 08:20 with sunset 17:25 / sunrise 07:05, true at 18:30 and at 05:00.
- The dusk palette: wall, roof, road and ground colours at 18:30 are pairwise different by at least 0.06 in relative luminance, and roof > wall, road > ground.
- `followPitchFor({ blocked: true, pitch, maxPitch })` raises toward `maxPitch`; `{ blocked: false }` eases back to the base pitch.
Keep every existing test green (`grep -l "aviation\|routeAhead\|follow" web/tests/*.test.js` and run them).

Run only:
```
cd web && node --test tests/scene-29L1.test.js $(grep -l "aviation\|routeAhead\|needsAviationLight\|look.js\|sky.js" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Labels, toolbar, timeline and panels (29L2 does those), `web/src/ui/*`, `web/src/chatmap.js`, consult/verify, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
