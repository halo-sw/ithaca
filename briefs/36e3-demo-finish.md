# Stage 36e3 — finish the demo swap: readable names in replies, the same-station line, the share headline says 매매, the remaining pinned tests (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no build. You may run `node` scripts that only read `data/build` to compute values. Branch `ithaca-17`; 36e + 36e2 are in the tree (uncommitted).

The money-file flip that 36e2 hit is fixed. Another session was writing the shared `data/build/sim`; this worktree now has its own `data/build/sim`, regenerated from the new scenario. Read it freely; it will not change under you. `18-1 parity` passes now.

First edit within 3 tool calls. Stop when the named tests pass.

## 1. Product fixes the new recorded reply exposed (`web/src/ui/demotour.js` profile_search, the reply builder that wrote it)
1. **Lot-number names.** The reply shows `(647)` and `(92-0)`. `displayNameFor` (`src/homes.js:564-582`) already turns these into `판교동 오피스텔 (647)` for the cards. Use it in the text the agent/reply builder writes for each candidate (find where candidate lines like `이름(종류·지역, N㎡): 중간 …` are formatted, e.g. `grep -rn "3D로 살아 보기 가능" src`). The tool result keeps the raw `name`.
2. **Same station.** `판교 → 판교 총 5분(추정, 지하철은 안 타요)` reads wrong. When the origin station is the workplace station, write `판교역까지 걸어서 5분 (지하철 안 타요)` in the reply line and in the card's `commuteRowLine` (36a). Same rule in English through the existing pattern. Do not invent a new wording elsewhere.
3. **The demo question gives a size.** A couple does not want a 20 ㎡ studio. Change the recorded question to `판교로 출근하는 맞벌이 부부, 연봉 6천+5천, 모은 돈 2억, 7억 이하로 50㎡ 이상 집을 사고 싶어`. Recompute the answer from a live `extract_profile` → `find_homes` (default sort, `limit: 6`) and update the demotour test to match, exactly as 36e2 did.
4. **Share headline** (`tests/share.test.js:252` now expects `A 효성올림픽카운티 · 56.22㎡ (전세)`). The scenario's tenure is `매매` for both homes, so the headline must say `(매매)`. Find where the headline picks its tenure. It must use `scenario.money.tenure[label]`, as the money doc does. Fix the code, then the test.

## 2. Remaining tests pinned to the old demo (36e2 ran out of steps)
Same rules as 36e2:
- read areas from the scenario (`st-송파나루`, `st-미금`);
- keep each test's intent;
- name every changed expectation (old → new, and where the new number comes from — this worktree's `data/build/sim/demo-two-homes-*.json`).

Tests to fix:
- `engine-workplace.test.js:332,367,398,412,430,459`. `no complex named "효성올림픽카운티"` means the fixture loads `songpa-jamsil`. The "B walks" cases: B now rides 미금 → 판교. Keep the walk coverage with a scenario override that puts B in `pangyo` (백현마을 705동, the 36d2 pick, which walks to 판교) inside the test.
- `consult-tools.test.js:412` ("reads real complexes, stations and places").
- `demotour.test.js:114` (recorded switch vs regenerated compare+money).
- `moments-17.test.js:72,81`.
- `share.test.js:237`.
- `sim-smoke.test.js:195,329`.
- `timeline-12b.test.js:223,240`: "the 08:50 A example" becomes a real A moment from day 1.
- `ui-render.test.js:255,264,275,314,386`: money tab heading, listings example, walked-hours, ride-time hero at a `t` inside A's ride, ride step.
- `verify-claims.test.js:311,316`: C01 values recomputed from the new build.

## Test
Run only:
```
cd web && node --test tests/demotour.test.js tests/engine-workplace.test.js tests/consult-tools.test.js tests/moments-17.test.js tests/share.test.js tests/sim-smoke.test.js tests/timeline-12b.test.js tests/ui-render.test.js tests/verify-claims.test.js tests/custom-18.test.js tests/affordable-demo-36e.test.js $(grep -lE "displayNameFor|commuteRowLine|3D로 살아 보기" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -30
```
"stage 10b UI render smoke" and "real-build engine values (16b)" had older failures before 36e. Report what still fails inside them, but do not chase those older ones. If anything else still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/aerial/**`, `src/journey-scene.js`, `src/main.js`, `pipeline/**`, `relay/**`, `data/`, `README*`, `public/recorded/**`, `scenarios/demo-two-homes.json`.

## Final message
Changed files, one line each. Every changed expectation (old → new, source). Nothing else.
