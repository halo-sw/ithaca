# Video v4 — copy tests stop depending on which real stats are null (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Touch only `video/tests/copy.test.js`. Do not edit `video/data/*` (the orchestrator owns the numbers and the script).

## Why
`cd video && npm test` → 56 pass, 3 fail. The orchestrator filled `jeonse_fraud_victims_2030_pct` (75) and `jeonse_fraud_source` in `data/stats.json`, and the v4 `data/script.json` renamed the "meta" table scene to `"built"`. Three tests read the real files and assumed those stats were null and the scene was called "meta":
- `drops a line whose stat is null` (line 22)
- `fillSource drops a source whose stat is null` (line 56)
- `real meta rows: last row drops, first three stay` (line 95)

## Change
- The two null tests use a local copy: `const nulledStats = { ...stats, jeonse_fraud_victims_2030_pct: null, jeonse_fraud_source: null }` — same assertions, so they keep testing the drop rule without depending on today's data.
- The meta-rows test finds the scene whose `table_en` has a cell containing `{stat:spark_open_same}` (today id `"built"`), fails clearly if none, and keeps its table assertions (full length, one row drops when `spark_open_same` is null). Rename it "real built-with table: Spark Open row drops when its stat is null".

Run `cd video && npm test 2>&1 | grep -E "^# (pass|fail)|^not ok"`.

## Final message
Suite line.
