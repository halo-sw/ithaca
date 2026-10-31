# Stage 36i6 — `verifyHomeFor` hands over the tenure key, not the Korean word (brief for Muse)

Agent mode, rules in `AGENTS.md` and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls.

36i5 added `tenure` to `verifyHomeFor` (`web/src/chat/custom-money.js:404-420`). But `moneyDoc.default_tenure[label]` is the Korean word (`매매`, `전세`, `월세`, `공공임대`), while `reportDigest` (36i4) matches the keys `trade`, `jeonse`, `wolse`, `public`.

## Change
- Keep reading the money with the Korean word as today.
- Return `tenure` as the key: 매매 → trade, 전세 → jeonse, 월세 → wolse, 공공임대 → public. A value that is already a key passes through.
- Update `web/tests/report-check-29j3.test.js` "reads US rent, KR tenure money, and missing docs": its fixture uses `전세`, so the expected object gets `tenure: "jeonse"`.
- In `web/tests/c02-meaning-36i4.test.js`, the 36i5 case uses `default_tenure.A = "매매"` (the real shape) and expects `tenure: "trade"` and a C02 `meaning_ko` with `대출 상환`.

Run only:
```
cd web && node --test tests/c02-meaning-36i4.test.js tests/report-check-29j3.test.js $(grep -lE "verifyHomeFor" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Do not touch
Everything except `verifyHomeFor` and those two test files.

## Final message
Changed files, one line each. Nothing else.
