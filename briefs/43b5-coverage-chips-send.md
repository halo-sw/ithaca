# Stage 43b5 — coverage chips send a chat turn, so they work in a Muse session too (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the ranges named here. Stop when done.

## Seen (orchestrator capture after 43b4, live Muse session)
I typed `I work at Meta HQ in Menlo Park. Renting alone, up to $3,000 a month.` and clicked `Show homes up to $3,600`. The header summary changed to `rent up to $3,600/mo`, but no new search ran: the card still reads `0 candidate homes … above your $3,000`.

**Cause.** `handleCoverageChip` (`web/src/ui/chat.jsx`, search `43b3: coverage-note chips`) sets the profile and calls `liveResearch(next)`. `liveResearch` (search `function liveResearch`) returns early when `!dataRef.current`. In a Muse session the rule-flow data (`ensureData`, search `async function ensureData`) is not loaded, so nothing runs. `meta` (`handleTrayWorkplace`) and `nocommute` (`handleTrayNoCommute`) also go through `liveResearch`, so they fail the same way.

## Change
In `handleCoverageChip`, `budget`, `meta` and `nocommute` send a normal chat turn through the same function the composer uses on Enter (search for the composer submit handler that calls `send(`). Muse or the rule flow then re-searches, and the customer sees what was asked:

| chip | English (`LANG === "en"`) | Korean |
| --- | --- | --- |
| `budget` | `Show homes up to $3,600 a month.` (the chip value, formatted with `fmtMoney(v, "USD")`) | `월세 $3,600 이하로 다시 찾아 줘.` |
| `meta` | `My workplace is Meta HQ in Menlo Park.` | `직장은 멘로파크 Meta 본사예요.` |
| `nocommute` | `I don't commute. Show homes without a commute.` | `출근 안 해요.` |

`seoul` stays `handleExample()`. Do not change the profile directly any more for these three.

## Tests — new `web/tests/coverage-chips-43b5.test.js` (do not edit other test files)
- The rule parser reads each sentence. Use `extractStep` the way `chat.jsx` does — find its import at the top of `chat.jsx`, and if needed look at one existing test that calls it (`grep -l extractStep web/tests | head -1`, read only its first 30 lines). Starting from a USD Meta HQ profile with `monthlyMax` 3000:
  - the budget sentence → `monthlyMax` 3600;
  - the meta sentence → the workplace resolves to Meta HQ;
  - `출근 안 해요.` → `noCommute`.

  If the English budget sentence does not parse to 3600, change the sentence to one that does (for example `rent up to $3,600 a month`), not the parser.
- Source check: `handleCoverageChip` no longer calls `liveResearch` or `handleTrayWorkplace` directly for these three ids.
- Run only: `cd web && node --test tests/coverage-chips-43b5.test.js tests/coverage-fixes-43b4.test.js tests/coverage-ui-43b3.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If a test still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/i18n/*`, `web/src/consult/*`, other test files.

## Final message
Changed files one line each, plus the final sentences used.
