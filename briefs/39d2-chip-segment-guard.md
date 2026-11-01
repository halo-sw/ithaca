# Stage 39d2 — the chip segment result survives the number pass (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Touch only `web/src/i18n/translate.js`.

## Why (diagnosed)
39d's segment block at the top of `translateCore` sets `result` for "디지털미디어시티 출근 · 1인 · 주 3일 출근 · 전세 3억 원 이하" correctly, but the next block — `if (numFirst) { … result = exactOrPattern(loc); … }` (`translate.js` right after `let cand = core;`) — runs unconditionally whenever the core has 억/만 원 and overwrites it with the whole-string pattern result ("… Ju 3 days commute …"). The test fails only because this chip contains "3억".

## Change
Make the numFirst block run only when `result === undefined` (e.g. `if (numFirst && result === undefined)`), and keep `cand` consistent (if the segment block produced the result, nothing after it should touch `result`). Nothing else changes.

Run only:
```
cd web && node --test tests/english-leftovers-39d.test.js tests/english-trust-29a1.test.js tests/en-names-29L6.test.js tests/english-names-39c.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed lines and the test counts.
