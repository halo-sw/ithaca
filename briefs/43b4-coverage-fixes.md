# Stage 43b4 — two fixes after the 43b3 live check (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the ranges named here. Stop when done.

## 1. The budget chip does nothing when Muse answered
**Seen.** In a live Muse session, `I work at Meta HQ in Menlo Park. Renting alone, up to $3,000 a month.` shows the coverage card with `Show homes up to $3,600`. Clicking it changes nothing.

**Cause.** `handleCoverageChip("budget")` in `web/src/ui/chat.jsx` (search `43b3: coverage-note chips`) reads `chip.value ?? chip.suggestUsd`. Only the rule flow adds `value` to the chip (search `43b3: a USD search with no candidates`). The server `find_homes` result (`web/src/consult/tools-search.js`, the `coverage_note` built from `coverageNote`) has the number in `result.coverage.suggestUsd`, not on the chip. So `v` is NaN.

**Fix.** In the handler, fall back to `stateRef.current.candidatesData.result.coverage.suggestUsd`. Better still, have `coverageNote` itself (`web/src/homes.js`) put `value: suggestUsd` on the budget chip, so both paths carry it, and drop the rule-flow chip mapping.

## 2. "Belle Haven–Sunnyvale" reads as the wrong corridor ends
**Seen.** `coverageNote` (`web/src/homes.js`) uses `usAreas[0]` and `usAreas[last]`. `US_REGION_IDS` starts with `us-menlo` (Belle Haven, mid-corridor), so the sentence says `Belle Haven–Sunnyvale`.

**Fix.** The two ends are the first and last `us-st-*` ids in `US_REGION_IDS` order: San Francisco and Sunnyvale. `usAreas` (the list the map card shows) stays as it is.

## Tests — new `web/tests/coverage-fixes-43b4.test.js` (do not edit `coverage-43b.test.js` or `coverage-ui-43b3.test.js`)
- The `coverageNote` budget chip has `value` equal to `suggestUsd`.
- The sentence contains `San Francisco–Sunnyvale` and not `Belle Haven–`.
- Source check: `handleCoverageChip` reads `coverage` or `chip.value` (no NaN path).
- Run only: `cd web && node --test tests/coverage-fixes-43b4.test.js tests/coverage-43b.test.js tests/coverage-ui-43b3.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If a test still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/i18n/*`, other test files.

## Final message
Changed files one line each.
