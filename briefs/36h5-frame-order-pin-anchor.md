# Stage 36h5 — size and place the ride markers with the camera that renders the frame, the pin's dot on its point (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; 36h3 is committed (a1870b9) and the suite is green (2837). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Measured by the orchestrator in real Chromium (temporary console probes, now removed)
A's 8호선 ride, `?mode=sim&scenario=demo-two-homes&day=1&follow=1&home=A&t=07:54`, 1440×810.

1. **Dots are sized with a stale camera.**
   - In `updateMarkerScale` (`journey-scene.js:~495`) the camera is at `[5943, 5962, 11447]`. That is 14,041 m view depth, fov 10, s = 1, 11.9 px projected.
   - Just before `renderCtl.renderFrame` (`main.js:~3782`) the same frame's camera is at `[2717, 2044, 6071]`, about half the distance.
   - On screen the dots are about **41 px**. Hiding `dotMesh`/`dotHull` removes the circles, so they are the dots.
   - Cause: in the frame loop (`main.js:~3753-3782`), `journeyLayer.setTrain(...)`, `journeyLayer.updateMarkerScale(...)` and `journeyLayer.updateStationLabels(...)` run **before** `trackSimViewOffset(camera)` and `controls.update()`, which move the camera.
2. **The pin's dot is 48 px left of its point.**
   - The projected point is right: `style.left 540px`, on the drawn line.
   - `.trainpin` (`web/src/style.css:47-50`) uses `transform: translate(-50%, -50%)` on the whole pill (dot + 6 px gap + label). So the **pill's centre** lands on the point, and the dot sits left of it. Computed: `matrix(1,0,0,1,-48.4,-10.25)`.
3. **Station labels are stale.** `updateStationLabels` runs only in the `rising`/`cruise`/`descending` phases. In the follow view the labels stay where an earlier camera put them; 복정 is 130 px off its dot.

## Change
1. **Frame order** (`main.js` frame loop):
   - Run `setTrain`, `updateMarkerScale` and `updateStationLabels` **after** `trackSimViewOffset(camera)` and `controls.update()`, right before `renderCtl.renderFrame`.
   - Keep their phase conditions, but `updateStationLabels` runs whenever the journey layer is visible: every phase that shows the line and dots. When a phase hides them, the labels hide too.
2. **Pin anchor** (`style.css` `.trainpin`): the dot's centre sits on the point. Example: `transform: translate(-10px, -50%)`, where 10 px is half the 20 px dot. The label stays to the right. Keep the dot's size and border.
3. **No other change** to sizes, colours or the 36h3 lift and depth logic.

## Test — new `web/tests/frame-order-36h5.test.js`
- **Source order** (read `src/main.js` as text, the same way existing source-order tests do; `grep -l "readFileSync.*main.js" tests/*.test.js`): in the sim frame loop, the indices of `journeyLayer.setTrain(`, `journeyLayer.updateMarkerScale(` and `journeyLayer.updateStationLabels(` are all greater than the index of `controls.update()`, and less than `renderCtl.renderFrame(`.
- **Labels every visible phase:** `updateStationLabels` is no longer gated to rising/cruise/descending only. Assert by source, or by a pure helper if you add one.
- **Pin CSS:** read `src/style.css`. `.trainpin` has no `translate(-50%` on X, and its X translate equals minus half of `.trainpin-dot` width.
- **Keep green:** `train-pin-dots-36h3`, `official-marker-36g`, and every test that mentions `updateMarkerScale`, `setTrain`, `trainpin`, `updateStationLabels` or `renderFrame`.

Run only:
```
cd web && node --test tests/frame-order-36h5.test.js tests/train-pin-dots-36h3.test.js tests/official-marker-36g.test.js $(grep -lE "updateMarkerScale|setTrain|trainpin|updateStationLabels|renderFrame" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`, `scripts/money.mjs` (another brief).

## Final message
Changed files, one line each. Nothing else.
