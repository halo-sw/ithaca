# Stage 36d2 — 36d fallout: real-data engine tests after the dwelling pick, and the joined Korean + English profile text (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 36d is in the tree (uncommitted). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (full suite after 36d; `data/build` is present locally)
Four suites passed before 36d and fail after it:
1. `tests/engine-workplace.test.js`:
   - "rides from A, walks from B" → `Cannot read properties of undefined (reading 'label')`;
   - "rides from B when the walk limit drops below the B walk" → `B rides once the 16-minute walk exceeds the limit`;
   - "walks the destination graph in-area" → `expected a destination walk trip`.
2. `tests/engine-simulate.test.js` "branches station entrances on real pangyo data" → expected 2, got 0.
3. `tests/education.test.js` "measures real homes: OSM counts and graph minutes (built areas)" → `'pangyo'`.
4. `tests/english-trust-29a1.test.js` "extract_profile reads the customer's original words":
   - the server joins `context.customer_text` and `args.text` (`consult/tools-search.js:138`);
   - `extract_profile("맞벌이 예비부부, 강남 출근, 전세 4억 이하, 59㎡ 이상\ndual-income engaged couple, commute to Gangnam, jeonse up to 400M, 59 m2+")` now gives `depositMax = null`;
   - each half alone still gives 400,000,000.

Cause of 1–3 (likely): the 36d dwelling filter in `resolveHome` (`engine/scenario.js`) now picks a different 백현마을 building on the real 판교 data. The old pick was a 16.8 ㎡ guard booth (`경비실5`), so the old pick was wrong and the tests were pinned to it.

## Change
1. **Real-data engine tests.** Print which building `resolveHome` now picks for each home in the failing fixtures: id, `register.sub_name`, levels, area, distance to its graph node.
   - **If the new building is a real dwelling** (levels ≥ 3, not 경비/관리/상가…) and the failure only comes from pinned numbers or trip shapes that assumed the old building, update those expectations. Keep each test's intent:
     - A rides, B walks;
     - B rides once its walk exceeds the limit (recompute the limit from the new B walk);
     - entrance branching;
     - education minutes.
   - **If** the new pick is a building with no graph node within the usual snap distance, or the failure is `undefined.label` because a trip is now missing, fix `resolveHome` instead: among dwellings, require a graph node within the same distance the old code effectively accepted, else fall back as today. Do not loosen the dwelling filter.
   - **Name every changed expectation** in the final message, with the old → new value and why.
2. **Joined text** (`web/src/profile.js`, the 36d money exclusion and before-anchor rule):
   - **Find the cause.** Find why the joined Korean + English text loses `depositMax`. Suspects:
     - the same amount appears twice (`4억` and `400M`) and one copy is excluded as "taken";
     - or the English `up to 400M` is read as a before-anchor amount for another field.
   - **Fix it.** The joined text must give `depositMax` 400,000,000 and tenure `jeonse`.
   - **Don't regress.** All the 36d price cases must still pass.

## Test
Add the joined-text case to `web/tests/honest-parts-36d.test.js`.

Run only:
```
cd web && node --test tests/honest-parts-36d.test.js tests/engine-workplace.test.js tests/engine-simulate.test.js tests/education.test.js tests/english-trust-29a1.test.js $(grep -lE "resolveHome|extract_profile" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/money/**`, `src/aerial/**`, `src/journey-scene.js`, `relay/**`, `data/`, `README*`, `scenarios/`, `pipeline/**`.

## Final message
Changed files, one line each. Each changed test expectation: old → new, why. Nothing else.
