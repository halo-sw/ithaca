# Stage 36e4 — the last tests pinned to the old demo (test edits only, brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no build. Branch `ithaca-17`; 36e–36e3 are committed (74c6b72). This worktree has its own `data/build/sim`, regenerated from the new scenario.

**Edit tests only.** Do not change `src/`. Do not re-probe what is already measured below: these are your own 36e3 measurements. Apply them directly. First edit within 2 tool calls. Stop when the named tests pass.

## Apply
1. **`tests/engine-workplace.test.js:332,367,398,412,430,459`.**
   - Load A from `data/build/st-송파나루/area.json` instead of `P.jamsil`.
   - The B-walk cases use a scenario override inside the test: B → `{area: "pangyo", complex_name: "백현마을"}`, work `station_name {A: "송파나루", B: "판교"}`, `destination_station {A: "판교"}`.
   - Measured: B walk 11.1 min one-way. A limit of 10 forces the pseudo-ride (`ride: null`, `목적지 역 없음`). The `:430` destination walk on pangyo is 3.4 min, remote false.
2. **`tests/consult-tools.test.js:412`.** Call `list_complexes` with `query: "올림픽"` (the list truncates at 100) and expect `효성올림픽카운티`. Stations include `송파나루`.
3. **`tests/moments-17.test.js`.**
   - `:72` expects `8호선 석촌→복정 혼잡 109% (실측)` (from `demo-two-homes-A.json`).
   - `:81`: the helper gives 20011, the engine 20011.4. Compare with `Math.round` on the engine side; keep exactness otherwise.
4. **`tests/share.test.js`** real-build case:
   - walk_30d `12시간 44분` / `4시간 59분`;
   - pass `tenures: {}` so the headline proves the 매매 fallback: `A 효성올림픽카운티 · 56.22㎡ (매매)`.
5. **`tests/sim-smoke.test.js`.**
   - `:195`: `ride_minutes` 30 → 32.2 (scenario).
   - `:329`: station 잠실 → 석촌 (A.json).
6. **`tests/timeline-12b.test.js`.**
   - `:223`: rewrite the example at minute 480: 10 steps (current index 8), walk segment `07:37–07:44`.
   - `:240`: commuteMin 85 → 78 (A.json).
7. **`tests/ui-render.test.js`.**
   - `:255`: heading `매매로 사면 매달 집에 드는 돈` (copy.js `TENURE_PLAIN_LEAD`).
   - `:264`: example text starts `송파구 방이동 올림픽카운티` (listings.jsx:27).
   - `:275`: walked-hours `12시간 44분` / `4시간 59분`.
   - `:314`: `t` 08:40 → 08:00 (A's ride is minutes 464–496).
   - `:386`: same ride window for the steps.
8. **`tests/verify-claims.test.js:311,316`.** C01 A 42.7 → 39.2, B 16.5 → 8.3 (via `engineValue`). Rename the test titles to match.

## Test
Run only:
```
cd web && node --test tests/engine-workplace.test.js tests/consult-tools.test.js tests/moments-17.test.js tests/share.test.js tests/sim-smoke.test.js tests/timeline-12b.test.js tests/ui-render.test.js tests/verify-claims.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -30
```
"stage 10b UI render smoke" and "real-build engine values (16b)" had older failures before 36e. Leave those older ones. If a listed test still fails after 2 attempts, stop and print its message.

## Do not touch
Everything outside `web/tests/`.

## Final message
Changed test files, one line each. Anything that still fails, with its message. Nothing else.
