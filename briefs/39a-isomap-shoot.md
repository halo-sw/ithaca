# Stage 39a — "isomap" shooting mode: the 3D scene with the real aerial drape, shot from a fixed isometric camera, saved as square tiles (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only what you grep. Stop when the named tests pass.

## Why
We want a painted isometric neighbourhood map like hypeseoul.xyz: real 3D (OSM footprints + 건축물대장 floors + terrain) → shot from one fixed oblique camera, tile by tile → each tile repainted by an image model (done later by the orchestrator, not in this stage). The 3D view already drapes live aerial photos on the ground and the roofs (`web/src/aerial/drape.js`, `drapeAerial` called from `web/src/main.js:~438-457`, US via USGS, Korea via the `/api/tiles` relay/dev proxy). This stage only adds a clean, deterministic way to shoot that scene.

## Changes
1. **Dev data dir override** (`web/vite.config.js:~16`): `DATA_DIR` = `process.env.ITHACA_DATA_DIR` (absolute) when set, else today's `data/build`. When `<file>.json` is missing but `<file>.json.gz` exists, the dev data middleware serves the gunzipped JSON (the release tarball stores some boxes gzipped, e.g. `st-압구정/area.json.gz`). Production build untouched.
2. **Shooting mode in the 3D page** — query `?isomap=1&area=<box id>&lon=<lon>&lat=<lat>&span=<metres, default 240>&az=<deg, default 45>&el=<deg, default 35>&px=<default 1024>`. Find how the 3D page already opens an area from the URL (grep `searchParams` / `params.get` in `web/src/main.js`) and reuse it. In this mode:
   - aerial drape forced on (ground + roofs, the existing path); if the drape fails, set `window.__isomap = { ready: true, ok: false, reason }`.
   - hide all chrome and overlays: UI panels, labels/pills, people, pins, route lines, timeline, credits overlay (the credit text is returned in `window.__isomap.credit` instead, from `aerialCreditFor`).
   - `THREE.OrthographicCamera` centred on (lon, lat) at ground height, looking down at azimuth `az` (0 = from south) and elevation `el`, frustum sized so `span` metres of ground fit the square; canvas `px`×`px`, devicePixelRatio 1.
   - fixed daylight (one directional sun from the south-west + soft ambient, shadows on if the renderer already supports them), no fog, no animation, sky/background a flat light neutral.
   - after the drape finished and two frames rendered: `window.__isomap = { ready: true, ok: true, credit, area, lon, lat, span, az, el }`.
3. **Shooting script** `web/scripts/isomap-shoot.mjs` (playwright-core, `executablePath` `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, headless, args `--use-angle=metal --ignore-gpu-blocklist`, the same launch the repo's other capture helpers use if any): args `--base http://localhost:48750/ --out <dir> --area <id> --lon <lon> --lat <lat> [--span 240] [--grid 1|2|3] [--overlap 0.15]`. For `--grid N` it shoots N×N tiles around the point (tile centres stepped by `span*(1-overlap)` east/north in the ground plane), waits for `window.__isomap.ready` (timeout 90 s), saves `<out>/<area>_<r>_<c>.png` from the canvas and writes `<out>/<area>.json` with every tile's lon/lat/span/az/el/credit/ok.

## Tests — new `web/tests/isomap-39a.test.js`
- The pure helpers you add (parse the isomap query with defaults and clamping: span 60–1200, el 15–75, px 256–2048; the N×N tile-centre stepping in metres → lon/lat, using the repo's frame helpers) — exact numbers.
- `resolveDataPath`/the gz fallback helper: missing `.json` + present `.json.gz` resolves to the gz path; traversal still 403.
Keep green: `tests/aerial*.test.js`, `$(grep -l "vite.config\|resolveDataPath\|drapeAerial" tests/*.test.js)`.

Run only:
```
cd web && node --test tests/isomap-39a.test.js $(ls tests/aerial*.test.js 2>/dev/null) $(grep -l "vite.config\|resolveDataPath\|drapeAerial" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`, normal (non-isomap) 3D behaviour. Final message: changed files, one line each, plus how to run the script. Nothing else.
