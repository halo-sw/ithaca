# Stage 34b2 — one English member-label scheme after merging main's 29L4 (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Two stages fixed the same bug, a romanized `나` ("na") in the English report, in two ways:
- **34b (yours, this branch):** `profile.js` `MEMBER_LABEL_EN` (`나` → `me`, `배우자` → `spouse`, …), and `reportDigest` wrote the English label into `label_ko`.
- **29L4 (main, now merged):** `reportDigest` keeps `label_ko` Korean and adds `label_en` (`나` → `You`, `배우자` → `Your partner`, else as is), and `REPORT_PROMPT_EN` says "call members by label_en".

The orchestrator resolved the merge with main's `verify/compare.js` and `consult/report.js`. Now one test fails: `tests/en-report-names-34b.test.js` "34b report input carries English member labels" (it expects `label_ko: "me"`).

## Change
1. **One table.** Make `profile.js` `MEMBER_LABEL_EN` the single source and have `reportDigest`'s `label_en` use it.
   - `나` → `You`, `배우자` → `Your partner`, `아이` → `Your child`, `부모` → `Your parent`, `형제자매` → `Your sibling`, `동거인` → `Your housemate`, `함께 사는 사람 N` → `Housemate N`, `구성원 N` → `Member N`.
   - A custom label passes through. Korean stays as is.
   - Keep main's `label_ko` (Korean) and `label_en` fields exactly as 29L4 defined them.
2. **Reverse lookup.** `memberLabelKo` / `numbers.js` `memberKeyFor` map these English labels back to the same member, case-insensitive, and also accept the 34b forms (`me`, `spouse`) for older recorded runs.
3. **Tests.** Update `tests/en-report-names-34b.test.js` to the merged scheme: `label_ko` stays Korean, `label_en` is `You` / `Your partner`, no Hangul in `label_en`, and "You averaged 5 min" checks against 나's numbers. Keep main's `report-members-29k1.test.js` assertions as they are.

Run only:
```
cd web && node --test tests/en-report-names-34b.test.js tests/report-members-29k1.test.js tests/submit-report-29j2.test.js tests/verify-compare-29j1.test.js $(grep -lE "memberLabelFor|memberKeyFor|reportDigest" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/consult/report.js` prompts, UI files, `src/i18n/**`, `briefs/`, `data/`.

## Final message
Changed files, one line each. Nothing else.
