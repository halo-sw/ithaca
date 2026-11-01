# Stage 29N3k — CI green again: the 29N3 profile test skips when the real homes files are missing (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 2 tool calls. Stop when the named test passes.

## Why
CI on main fails since 39334f2: `not ok 742 - 29N3 scenarioFromProfile for Caltrain homes` with `ENOENT … data/build/homes/us-st-palo-alto.json` and `… homes/us-menlo.json`. CI has no `data/build`. The describe at `web/tests/us-caltrain-30d-29N3.test.js:51` reads real homes (helper at ~line 36) with no skip guard; the live-run describe at line 87 already has one.

## Change
Only in `web/tests/us-caltrain-30d-29N3.test.js`: give the describe at line 51 the same `{ skip: … }` guard as line 87, checking `data/build/homes/us-st-palo-alto.json` and `data/build/homes/us-menlo.json`, with a clear message. Do not change any assertion. No other file.

Run only (both must pass; the second simulates CI by hiding the files from the check):
```
cd web && node --test tests/us-caltrain-30d-29N3.test.js 2>&1 | grep -E "^# (pass|fail|skipped)|not ok"
```
Final message: the changed lines. Nothing else.
