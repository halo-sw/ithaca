# 47p — exact saved-record checks

Muse only. Three small corrections. Budget 10 steps. No browser, git, build, full suite, or subagents.

1. In `web/scripts/life-plan-audit.mjs`, line ~392 currently reads `days30: !!(meta && meta.days30)`. The engine field is `meta.days` and its numeric value must equal `30`. Change this assertion to check that exact field and value. Keep all other assertions. The browser already completed 134 decisions and both members' exact preference assertions passed; do not change product code to satisfy this mistaken fixture.

2. In `web/src/chat/recording.js`, `scenarioKey` uses `canon` from `engine/canonical.js`. That helper rounds every floating-point value to 3 decimal places. This permits two different coordinates (~100 metres apart) to compare equal. Import and use `stableStringify` from `life/plan.js` for exact, sorted-key scenario equality. No rounding. Add a regression to `web/tests/replay-integrity-47n.test.js` where only a coordinate below 0.001 changes; the bundle must be rejected. The original exact bundle still passes.

3. In the same QA script, intentional fixture `diary` and `report` 503 responses should be recorded as expected by task. Do not classify unrelated tile failures as expected. Keep browser page errors fatal. This remains controlled QA, never live-model evidence.

Read only the named small ranges and the replay test fixture. Run `node --check web/scripts/life-plan-audit.mjs` and `node --test web/tests/replay-integrity-47n.test.js` with tail -15. Stop.
