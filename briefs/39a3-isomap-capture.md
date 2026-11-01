# Stage 39a3 — isomap: capture the canvas pixels, not a hidden element (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 2 tool calls. Stop when the named tests pass.

## Live run after 39a2
`window.__isomap` = `{ready:true, ok:true, drape:{source:"naip",size:2048,ok:true}, …}` — good. But a page screenshot is a blank beige square, and `web/scripts/isomap-shoot.mjs:72` (`canvas.screenshot`) times out: the chrome-hiding loop in `bootIsomap` hides every `body > *` whose id is not `scene-wrap`/`scene` — the canvas sits inside a hidden ancestor, so it is not visible.

## Changes
1. `bootIsomap` hiding: never hide the canvas or any ancestor of `renderer.domElement`; hide siblings along that ancestor chain instead (and the overlay selectors as today). Pin the canvas wrapper `position:fixed; inset:0; width:px; height:px` so the canvas is exactly px×px at the top-left.
2. Expose `window.__isomapShot = () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); }` (render and read in the same call so no `preserveDrawingBuffer` is needed; the post-processing/render controller, if one wraps the plain render, must be used the same way the normal frame does so the shot matches the view).
3. `isomap-shoot.mjs`: after `ready`, if `ok` is false log the reason and skip the tile; else take `await page.evaluate(() => window.__isomapShot())`, decode the data URL and write the PNG. No locator screenshots.

## Tests — extend `web/tests/isomap-39a.test.js`
- The ancestor-safe hide helper on a small fake DOM tree (objects with `parentElement`, `children`, `style`): the canvas and its ancestors stay visible, their siblings get `display:none`.
- The data-URL → Buffer helper used by the script (`data:image/png;base64,...` round-trips bytes).

Run only:
```
cd web && node --test tests/isomap-39a.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each. Nothing else.
