# Stage 29N4 — the demo's recorded numbers come from the current engine build (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
The published demo runs (`demo-two-homes-*`, 효성올림픽카운티 vs 분당 엠코 헤리츠) were built without the 판교 destination area, so they miss the 판교역 → workplace walk (41 m, 0.5 min each way). The orchestrator has rebuilt `data/build/sim/demo-two-homes-{A,B,compare,money}.json` with the current engine (`node web/scripts/simulate.mjs --scenario scenarios/demo-two-homes.json --home both --out data/build/sim/` + `money.mjs`); routes are unchanged, times shift by 1–2 min, 30-day walking becomes A 13시간 28분 / B 5시간 43분. The product owner chose to publish the new results. Seven tests and the demo tour still pin the old values.

## Change
Every place that states a demo number takes it from the rebuilt files — read the value from `data/build/sim/` (or recompute it through the same helper the test already uses) rather than typing a new constant where the test can compute it; where a recorded string must stay a literal (the tour text), copy the exact value the current build produces:
- `web/src/ui/demotour.js:~121` (`30일 동안 걸은 시간: A … → B …` and any other switch/compare numbers in that step).
- Tests: `tests/demotour.test.js` ("recorded switch numbers match the regenerated compare+money builds"), `tests/share.test.js` ("result card on the real demo build"), `tests/timeline-12b.test.js` ("matches the 08:00 A example", "covers 30 days with weekend flags"), `tests/ui-render.test.js` (share dialog "walked-hours A value"), `tests/verify-claims.test.js` (`demo-two-homes-A C01 is 39.2`, `B C01 is 8.3` → the current values, test names updated to match).
Never put a number a run did not produce. No engine changes.

Run only:
```
cd web && node --test tests/demotour.test.js tests/share.test.js tests/timeline-12b.test.js tests/ui-render.test.js tests/verify-claims.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`, `web/src/engine/`. Final message: changed files with the old → new values, one line each. Nothing else.
