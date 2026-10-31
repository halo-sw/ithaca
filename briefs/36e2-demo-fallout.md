# Stage 36e2 — 36e fallout: recorded replies from real runs, the browser money path knows the officetel, tests pinned to the old demo (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no build. You may run `node` scripts that only read `data/build` to compute values. Branch `ithaca-17`; 36e is in the tree (uncommitted). The orchestrator regenerated `data/build/sim/demo-two-homes-{A,B,compare,money}.json` from the new scenario (rule choices, `simulate.mjs --home both`, `money.mjs`). First edit within 3 tool calls. Stop when the named tests pass.

## 1. Recorded replies must come from real runs (`web/src/ui/demotour.js:96-125`)
36e changed `RECORDED_AGENT_REPLIES.profile_search.q` to a buying question but kept the old 전세 answer: `2,928곳`, 천사의도시Ⅱ오피스텔 1.85억 and so on. The `compare` reply also keeps the old numbers (`A 260만 원 → B 250만 원`, 걸은 시간, 남는 돈, 피곤한 정도). A recorded answer with numbers no run produced is not allowed.
- **profile_search.**
  - Keep the buying question, wording: `판교로 출근하는 맞벌이 부부, 연봉 6천+5천, 모은 돈 2억, 7억 이하 집을 사고 싶어`.
  - Compute the answer the way `tests/demotour.test.js:114-140` does: `extract_profile` then `find_homes` with the real build, `limit: 6`. Use the default sort (36a: `areas`, 동네별), not `commute`.
  - Write `a` from that output in the same line format. Each candidate line uses the 36a origin form (`정자 → 판교 총 N분 …`).
  - Update the tool summary (`정렬: 동네별`).
  - Update `tests/demotour.test.js:114-140` to the new total, names and sort. Keep the test's intent: the recorded numbers equal a live run.
- **compare.** Read the numbers from `data/build/sim/demo-two-homes-compare.json` and `-money.json` (매매). If a test already checks this reply against the build, make it pass; else add that check. Keep `어느 쪽이 나은지는 고객님이 정하세요.`
- **Tour steps.**
  - The `jeonse` step (`보증금 점검`) does not fit a buying demo. Point it at the money tab's `내가 내는 돈` / 살 때 드는 돈 view, caption `살 때 한 번에 내는 돈 — 오피스텔은 취득세 4%`. If no URL param opens that view, keep `tab: "money"`.
  - Check every caption's minutes against the regenerated run: A walk 6.4 → `6분`, B walk 1.7 → `2분`, `t` values inside the real legs (read `demo-two-homes-A.json` day 1 trips). Fix the `t` params so each step lands inside its leg.

## 2. Browser money path ignores the officetel (`tests/custom-18.test.js:335`)
`same monthly totals per home (±1원)` fails: `B 매매: 1889634 vs 1990522`. `money.mjs` passes `money.kind`, but the browser builder does not. Find the browser-side builder this test calls and pass `scenario.money.kind[label]` the same way. Do not change the expected tolerance.

## 3. Tests pinned to the old demo (레이크팰리스 / 백현마을 / songpa-jamsil / pangyo)
Update each to the new scenario. Keep each test's intent; do not delete assertions. Where a test hard-codes an area list or loads `songpa-jamsil`/`pangyo` for the demo, read the areas from the scenario (`st-송파나루`, `st-미금`) instead:
- `engine-workplace.test.js` 1–6:
  - `no complex named "효성올림픽카운티"` means the fixture loads the wrong area;
  - the "B walks" cases: B now rides 미금 → 판교. Rewrite them around a real walk case if the test needs one (e.g. a scenario override with B in `pangyo` 705동, as 36d2 left it). Keep the old real-data `pangyo` coverage.
- `consult-tools.test.js:412` reads real complexes: `list_complexes` on the demo's A area has `효성올림픽카운티`; stations include `송파나루`.
- `money-quality.test.js:39`.
- `moments-17.test.js:72,81`.
- `share.test.js:237`.
- `sim-smoke.test.js:87,192,281,323`: `:281` hard-codes four areas, so add `st-송파나루` / `st-미금` from the scenario.
- `timeline-12b.test.js:223,240`: the "08:50 A example" becomes a real A moment.
- `ui-render.test.js:255,264,275,314,386`: money tab heading, listings example text, walked-hours, the ride-time hero at a `t` inside A's ride, ride step.
- `verify-claims.test.js:311,316`: `demo-two-homes-A C01 is 42.7` / `B … 16.5`. Recompute from the new build and state the new values.

Name every changed expectation: old → new, and where the new number comes from.

## Test
Run only:
```
cd web && node --test tests/demotour.test.js tests/custom-18.test.js tests/engine-workplace.test.js tests/consult-tools.test.js tests/money-quality.test.js tests/moments-17.test.js tests/share.test.js tests/sim-smoke.test.js tests/timeline-12b.test.js tests/ui-render.test.js tests/verify-claims.test.js tests/affordable-demo-36e.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -30
```
`ui-render` "stage 10b UI render smoke" and "real-build engine values (16b)" had known failures before 36e. List what still fails in them, but do not chase those older ones. If anything else still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/aerial/**`, `src/journey-scene.js`, `src/main.js`, `pipeline/**`, `relay/**`, `data/`, `README*`, `public/recorded/**`, `scenarios/demo-two-homes.json` (ask in the final message if it needs a change).

## Final message
Changed files, one line each. Every changed expectation (old → new, source). Nothing else.
