# Stage 36i8 — the replay test reads the recording's run id instead of pinning it (brief for Muse)

Agent mode, rules in `AGENTS.md` and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls. Change `web/tests/replay-3d-36i2.test.js` only.

The orchestrator re-recorded `web/public/recorded/seoul-couple.json` (36i–36i7 fixes). Its simulation card now has a new `customId`, and the 36i2 test pins the old one, `"cmvwxbyxq1806"`.

## Change
- In the test, read the expected id from the recording itself: the last `kind: "simulation"` message with `data.status === "done"`.
- Assert that it is a non-empty string and equals `replayRunPlan(doc).customId`.
- Keep every other assertion.

Run only:
```
cd web && node --test tests/replay-3d-36i2.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each. Nothing else.
