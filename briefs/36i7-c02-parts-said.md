# Stage 36i7 — the C02 meaning names only the parts that were summed (brief for Muse)

Agent mode, rules in `AGENTS.md` and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls.

## Found by the orchestrator
A fresh Korean session now writes `대출 상환·관리비·공과금을 더한 한 달 금액은 2,055,222원이에요`.
- `monthlyTotal` (`web/src/verify/numbers.js:118-125`) sums only the fields present.
- The chat's `verifyHomeFor` gives `monthly_won` and `maintenance_won_month`, with no `utilities_won_month`.
- So the sentence names 공과금, which is not in the number.

## Change (`reportDigest` C02 branch, `web/src/verify/compare.js:~178-200`)
Build the meaning from the parts that are actually finite on `homes[label]`.

| Field | Korean | English |
|---|---|---|
| `monthly_won` | trade: `대출 상환`, wolse/public: `월세` | `loan payment` / `rent` |
| `maintenance_won_month` | `관리비` | `maintenance` |
| `utilities_won_month` | `공과금` | `utilities` |

- **Joining:** Korean joins with `·` and ends `을/를 더한 한 달 금액`. Use `을` after 공과금/관리비 as today, or simply `더한 한 달 금액`, e.g. `대출 상환·관리비를 더한 한 달 금액`. English joins with ` plus `, e.g. `loan payment plus maintenance for one month`.
- **jeonse** has no `monthly_won` part in the words, and keeps `(전세는 월세 없음)` / `(jeonse has no rent)`.
- **Unknown tenure:** `집에 드는 한 달 금액` plus the parts in parentheses.
- **USD:** unchanged.
- Never name a part that is not summed.

## Tests (`web/tests/c02-meaning-36i4.test.js`)
- **Trade home** with only `monthly_won` and `maintenance_won_month`:
  - `meaning_ko === "대출 상환·관리비를 더한 한 달 금액"` (no 공과금);
  - `meaning_en === "loan payment plus maintenance for one month"`.
- **Same home with `utilities_won_month`** also has 공과금 / utilities.
- Update the existing 36i4 expectations to match. Keep every assertion that a purchase never says 월세/rent.

Run only:
```
cd web && node --test tests/c02-meaning-36i4.test.js $(grep -lE "reportDigest|meaning_ko" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Do not touch
Everything except the `reportDigest` C02 branch and that test file.

## Final message
Changed files, one line each. Nothing else.
