# Stage 29N3e — finish 29N3d (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

Read `briefs/29N3d-us-30d-polish.md` (the why and the full change list). Already done in 29N3d (do not redo): one-way average and per-member rows include waits (`web/src/verify/numbers.js`, `web/src/ui/chat.jsx`); Caltrain station pill wording (`web/src/labels3d.js`); `Train`/`열차` legend flag (`web/src/timeline.js`, `web/src/ui/timeline.jsx`, `web/src/ui/app.jsx`, `web/src/main.js`).

Still to do, in this order:
1. English strings for the new Korean labels (`· 칼트레인`, `열차`) in `web/src/i18n/en-table.js` / `en-words` so the English UI reads `· Caltrain`, `Train` (never a romanisation).
2. Generic place labels in English (29N3d change 3): an unnamed park etc. reads `a park` in English moments/diary/3D, never `gongwon (공원)` (grep `romanizeName`, `scene-chrome.js`, the diary digest's lang handling).
3. `pipeline/homes_us.py`: drop station-box homes with unknown station walk, counted as `dropped_no_station_walk` (29N3d change 4).
4. Tests: new `web/tests/us-30d-polish-29N3d.test.js` (wait in average + longest, Korean unchanged; `Palo Alto Stn · Caltrain` / `Train` vs Korean subway wording; unnamed park → `a park`), and the Python drop test in `tests/test_homes_us.py`.

Run only:
```
.venv/bin/pytest -q tests/test_homes_us.py 2>&1 | tail -2
cd web && node --test tests/us-30d-polish-29N3d.test.js tests/us-caltrain-30d-29N3.test.js tests/us-measured-first-29N3b.test.js $(grep -l "commute_avg\|longest\|subway entrance\|지하철 입구" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `data/`, `relay/`, `briefs/`. Final message: changed files, one line each, plus updated expectations. Nothing else.
