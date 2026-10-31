# Stage 36i5 — the report's home carries its tenure (brief for Muse)

Agent mode, rules in `AGENTS.md` and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls.

36i4 picks the C02 meaning from `homes[label].tenure` in `reportDigest`. But the chat builds those homes with `verifyHomeFor` (`web/src/chat/custom-money.js:404-420`), which never sets `tenure`, so a purchase falls back to the generic meaning.

## Change
- In `verifyHomeFor`'s Korean branch, add `tenure` (the `default_tenure[label]` it already reads) to the returned object.
- Keep everything else.

## Test
Add to `web/tests/c02-meaning-36i4.test.js`:
- `verifyHomeFor` with a moneyDoc whose `default_tenure.A` is `"trade"` and `by_tenure.trade.housing.monthly_won` is a number returns `tenure: "trade"`.
- `reportDigest` fed that home gives a C02 `meaning_ko` with `대출 상환`.

Run only:
```
cd web && node --test tests/c02-meaning-36i4.test.js $(grep -lE "verifyHomeFor" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Do not touch
Everything except `web/src/chat/custom-money.js` (`verifyHomeFor` only) and that test file.

## Final message
Changed files, one line each. Nothing else.
