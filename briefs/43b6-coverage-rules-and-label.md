# Stage 43b6 — coverage chips in the rule flow, and say whose commute it is (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the ranges named here. Stop when done.

## Seen (orchestrator capture after 43b5, Muse unreachable so the rule flow answers)
1. **Budget chip in the rule flow.** I typed `I work at Google in Mountain View. Renting alone, up to $3,500 a month.` and clicked `Show homes up to $3,600`. The chip sent `Show homes up to $3,600 a month.`; the rule flow answered `I can do that once Muse reconnects.` and the budget stayed $3,500. 43b5 made every chip send a chat turn. That fixed the Muse session (verified: 1 candidate after the chip), but the rule passthrough does not read that sentence.
2. **Wrong workplace label.** I typed `I work at Google in Mountain View. Renting alone, up to $5,000 a month.` and got 6 candidates under the title `Google in Mountain View commute`. Each card says `Caltrain 38 min · walk 5 + wait 8 + train 4 + bike 22`. Those minutes are to Meta HQ, the only US commute in the data, so the label claims a commute that was never computed.

## Change (`web/src/ui/chat.jsx` and `web/src/homes.js` only)
1. **Chips by mode.** In `handleCoverageChip` (search `43b5: coverage-note chips`):
   - when the rule-flow data is loaded (`dataRef.current`), use the direct path, the 43b3 behaviour:
     - `budget` sets `monthlyMax` and calls `liveResearch(next)`;
     - `meta` calls `handleTrayWorkplace("Meta HQ")`;
     - `nocommute` calls `handleTrayNoCommute()`;
   - otherwise keep the 43b5 `send(...)` turn.
2. **Note with candidates.** In `coverageNote` (`homes.js`, search `export function coverageNote`), add an option `hasCandidates`. When `workplaceUnplaced && hasCandidates`, the workplace line becomes `미국은 Meta 본사(멘로파크)까지 출퇴근만 계산해요. 아래 출퇴근 시간은 ${workplaceText}이 아니라 Meta 본사까지예요.` The chips are `meta` and `nocommute` only (no budget, no seoul).
3. **Rule flow.** `runSearch` (search `43b3: a USD search with no candidates`) computes the note for every USD search whose workplace is unplaced, not only empty ones, and passes `hasCandidates`.
4. **Server.** In `web/src/consult/tools-search.js` (search `usEmpty`), add `coverage_note` the same way when the workplace is unplaced and there are candidates. Keep the empty case as it is.
5. **Card.** `CandidatesCard` (search `43b3: an empty US search shows the coverage note`) also renders the note lines and chips **above the list** when there are candidates. The empty case is unchanged.

## Tests — new `web/tests/coverage-label-43b6.test.js` (do not edit other test files)
- `coverageNote({ workplaceUnplaced: true, workplaceText: "Google in Mountain View", hasCandidates: true, coverage, budgetUsd: 5000 })`:
  - one line containing `아래 출퇴근 시간은 Google in Mountain View이 아니라 Meta 본사까지예요`;
  - chips `meta`, `nocommute`.
- The source checks:
  - `handleCoverageChip` branches on `dataRef.current`;
  - `CandidatesCard` renders note lines when `candidates.length > 0`.
- Run only: `cd web && node --test tests/coverage-label-43b6.test.js tests/coverage-chips-43b5.test.js tests/coverage-fixes-43b4.test.js tests/coverage-ui-43b3.test.js tests/coverage-43b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
  - If 43b5's source check (`handleCoverageChip` no longer calls `liveResearch`) now fails, that is expected.
  - Say so in your final message and do not edit that file; the orchestrator updates it.
- If a test still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/i18n/*`, `web/src/profile.js` (another stage is editing it), other test files.

## Final message
Changed files one line each, then any new Korean strings, one per line.
