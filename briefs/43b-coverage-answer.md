# Stage 43b — a clear answer when the workplace or budget is outside what Ithaca covers (brief for Muse)

Agent mode, rules in `AGENTS.md` (read "Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit in your first tool call. Stop when this part is done.

## Why (orchestrator capture, 2026-11-03, local production copy with live Muse)
Typing `I work at Google in Mountain View. Renting alone, up to $3,500 a month.` gives:
- the profile line `Google in Mountain View (Unknown)`;
- the map panel still showing the Korean placeholder card `Seoul · southeast Gyeonggi`;
- `0 candidate homes` and `No homes match. Try widening budget, size, or area.`;
- Muse's reply only says to loosen the budget or widen the areas, with no reason.

There are two real reasons, and neither is shown:
- **Budget.** The cheapest US home in the data is $3,541/mo (Redwood City; Zillow ZORI ZIP typical rent). Nothing is at or under $3,500.
- **Workplace.** US commutes are precomputed only to Meta HQ in Menlo Park (`commute.destination` "Menlo Park" in every US home file). A Google office in Mountain View cannot get commute minutes. Do **not** place it at a Caltrain station and pretend: those minutes do not exist.

Judges will type their own Bay Area workplace. An empty list with no reason reads as broken.

## Code you need (read only these ranges)
- `web/src/homes.js:71-83` — `usEmptyHint(homes, budget)`: the browser rule flow already finds the cheapest US ZIP rent above the budget (`usMonthlyMedian`). Reuse it; do not write a second minimum.
- `web/src/ui/chat.jsx:3450-3456` — the rule flow puts `emptyHint` into the candidates data. `chat.jsx:554-559` shows `조건에 맞는 집이 없어요…` and then `data.emptyHint`.
- `web/src/consult/tools-search.js:216-310` — server `find_homes`. Its return (`:297-309`) has `next: "no candidates under these conditions — loosen budget/size/regions with the customer"` when empty. US homes come from `needUsHomes(session)` (`:207`).
- `web/src/consult/guards.js:508` — `toolResultNumbers(toolResults)`: any number inside a tool result may be cited. So a number the reply uses must be in the tool result.
- `web/src/chat/engine.js:505-513` — the profile line for workplaces: `${where}${w.resolved ? "" : " (모름)"}` → "(Unknown)".
- `web/src/places-us.js:26-56` — `US_WORKPLACES` (Meta HQ only), `findUsWorkplace`, `META_HQ_EXAMPLE` / `META_HQ_EXAMPLE_KO`.
- `web/src/ui/chat.jsx:5444-5458` — the map panel's placeholder card when there are no regions and no candidates. It is always the Korean card.

## Change
1. **Coverage facts from data (pure).** Add `coverageSummary({ usHomes, budgetUsd })` in `web/src/homes.js` next to `usEmptyHint`. It returns:
   - `usAreas`: the US station area names in English, in corridor order from `US_REGION_IDS`;
   - `commuteTo: "Meta HQ (1 Hacker Way)"`;
   - `minMonthlyUsd`: the cheapest `usMonthlyMedian`;
   - `minMonthlyArea`: that home's area name;
   - `suggestUsd`: `minMonthlyUsd` rounded up to the next 100.

   `usEmptyHint` keeps its output and may call it.
2. **Server `find_homes` with zero US candidates.** Add `coverage: coverageSummary(...)` to the result. Change `next` to:
   - "say why in one or two sentences using coverage numbers only, then offer the chips".

   Then `toolResultNumbers` already accepts `minMonthlyUsd` and `suggestUsd`.
3. **Unplaceable US workplace.**
   - **Detection.** A USD profile whose workplace is not resolved: `findUsWorkplace` returns null and it is not `noCommute`.
   - **Profile line.** Show the typed text with ` · commute not computed` / ` · 출퇴근 계산 안 됨`, never `(Unknown)`/`(모름)`.
   - **Reply (rule flow and server tool result).** One sentence: `Ithaca computes US commutes to Meta HQ in Menlo Park only, so <workplace> has no commute minutes yet.` Korean: `미국은 Meta 본사(멘로파크)까지 출퇴근만 계산해요. <직장>까지 시간은 아직 없어요.`
   - **Chips:**
     - `Use Meta HQ (1 Hacker Way)` → re-runs with Meta HQ as the workplace, keeping the rest of the profile.
     - `Show homes without a commute` → `noCommute: true`, the same path as "출근 안 해요".
     - `Try a Seoul example` → the existing Korean example.
4. **Zero candidates, budget below the cheapest (US).**
   - **Reply.** Rule flow and Muse both say it, Muse from the tool result: `Ithaca covers <first>–<last> on Caltrain. The lowest rent there is $<minMonthlyUsd>/mo (<minMonthlyArea>, Zillow ZIP estimate), above your $<budget>.`
   - **Chips:** `Show homes up to $<suggestUsd>` (re-runs with that budget), `Use Meta HQ example`.
   - **Order.** When the workplace is also unplaceable, the workplace sentence comes first, then this one.
   - **Card.** Replace the generic `조건에 맞는 집이 없어요…` line with these sentences when they apply. Keep it for other empty cases.
5. **Map placeholder.** For a USD profile, the placeholder card at `chat.jsx:5444-5458` shows the US corridor instead of the Korean card:
   - heading `Caltrain corridor · Menlo Park`;
   - the US area names from `coverageSummary`.
6. **i18n.** Korean source strings in code, as the app does. The orchestrator adds the English entries to `web/src/i18n/*`. List every new Korean string in your final message.

## Tests — new `web/tests/coverage-43b.test.js`
- `coverageSummary` on the fixture US homes:
  - 8 areas in `US_REGION_IDS` order;
  - `minMonthlyUsd` equals the fixture minimum;
  - `suggestUsd` is the next 100 up.
- Server `find_homes` (fake session with a few US homes, budget $1,000):
  - `candidates` is empty;
  - `coverage.minMonthlyUsd` is present;
  - `toolResultNumbers([result])` contains `minMonthlyUsd` and `suggestUsd`.
- Profile line for an unresolved US workplace has no `(모름)` / `(Unknown)` and has `출퇴근 계산 안 됨`.
- Rule flow: `I work at Google in Mountain View. Renting alone, up to $3,500 a month.` with fixture homes gives:
  - the Meta-HQ-only sentence;
  - the lowest-rent sentence;
  - chips `Use Meta HQ (1 Hacker Way)`, `Show homes without a commute`, `Show homes up to $<suggestUsd>`.

  Drive it the way `numbers-always-42h.test.js` or `english-answers-41b.test.js` drives the rule flow. If no such path is pure, test the pure function that builds the reply and its chips.
- Run only this file plus `tests/consult-guards.test.js` and `tests/numbers-always-42h.test.js`: `cd web && node --test tests/coverage-43b.test.js tests/consult-guards.test.js tests/numbers-always-42h.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If a test still fails after 2 fix attempts, stop and print the last lines of the failure.

## Do not touch
`relay/*` (43a), `web/src/places/*`, `web/src/render/*`, `web/src/i18n/*`.

## Final message
Changed files, one line each, then the new Korean strings, one per line. Nothing else.

## Orchestrator after merge (not for Muse)
- Add English for the new strings to `web/src/i18n/en.js` / `en-table.js`.
- `web/src/consult/*` is bundled into the relay. Relay redeploy needed (one redeploy together with 43a).
- Live recheck: the Google sentence in English, a $1,000 Meta HQ request, and the same in Korean, at 1440 px and 390 px.
