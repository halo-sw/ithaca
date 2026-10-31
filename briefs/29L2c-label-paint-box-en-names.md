# Stage 29L2c — 3D labels are painted where they were placed; English 3D panels keep romanised place names and finish the capitals (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
Orchestrator captures after 29L2 (2026-11-01, real GPU):
1. **The home label is still cut at the left edge** (`우리 집 · 레이크팰리스 115동`, desktop and phone). `placeLabels` (`web/src/labels3d.js`) now clamps a box whose top-left is `(x, y)`, but `paintLabel20b` (`web/src/main.js:~1749-1795`) paints at the *anchor* `item._sx` with `transform: translate(-50%,-100%)` — so the painted box is `[_sx − w/2, _sx + w/2] × [_sy − h, _sy]`, not the box that was placed, and the clamp never reaches the screen.
2. **English regression:** the status line built in code now shows Korean place names — `Me · Commuting · 잠실 → 레이크팰리스 (4 min walk left)` (before 29L2 the translator romanised them: `Jamsil → Lake Palace`).
3. **Lower-case left over in English:** the 3D chip over the person reads `me`; "Household right now" rows read `me · Commuting …`, `Spouse · home · Evening …`; the Today list reads `home` and `workplace (assumed: Pangyo Stn nearby) work`.

## Changes
1. **One box from placement to paint.**
   - In the caller (`main.js:~1790-1805`), give `placeLabels` the box the label really occupies: `x = anchorX − w/2`, `y = anchorY − h` (keep `_sx/_sy` as the anchor).
   - `paintLabel20b` paints at the placed box: `left = wrapOffsetX + item.x`, `top = wrapOffsetY + item.y`, **no** translate (compute the wrap offset the same way `_sx` is computed today). Labels that were not moved therefore land exactly where they did before.
   - Update any 20b/20e test that pins the old transform to the new contract (never weaken what it checks).
2. **Romanised names in English strings built in code.** Wherever 29L2 builds English 3D-panel strings, pass place names through the same helpers the rest of the English UI uses (`romanizeName` from `web/src/i18n/romanize.js` and/or `displayNameFor` from `web/src/homes.js`; complexes with an English name keep it — `레이크팰리스` → `Lake Palace`, `잠실` → `Jamsil`, `판교역` → `Pangyo Stn`).
3. **Finish the English capitals** (code-built per language, Korean unchanged):
   - the floating chip over each household member: `Me`, `Your partner`, … (same labels as the panel headline);
   - "Household right now" rows: `Me · Commuting · Jamsil → Lake Palace (on foot, 4 min left) · Tiredness 20/100`, `Your partner · Home · Evening · Tiredness 23/100`;
   - the Today list: `Home`, `Work (assumed: near Pangyo Stn)`, other stops as their romanised names.

## Tests — extend `web/tests/scene-chrome-29L2.test.js`
- A label anchored at `(10, 300)` with `w = 200, h = 22` on a 1440×900 stage comes back from the caller-side helper / `placeLabels` with `x ≥ 4` and is painted with `left = x` (export a tiny `labelPaintStyle(item, wrapOffset)` helper and assert it has no `translate`).
- The English status helper with places `잠실` → `레이크팰리스` returns a string containing `Jamsil → Lake Palace` and no Hangul.
- English household row for 배우자 at home starts with `Your partner · Home`.
- English Today row for the workplace reads `Work (assumed: near Pangyo Stn)`.

Run only:
```
cd web && node --test tests/scene-chrome-29L2.test.js $(grep -l "paintLabel20b\|label20b\|placeLabels\|translate(-50%" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Route/lighting/camera, the 2D chat map, consult/verify, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
