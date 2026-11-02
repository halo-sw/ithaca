# Stage 43b3 — coverage note on screen: candidates card, chips, US map placeholder (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the line ranges named here (line numbers ±10 — search the quoted text if they moved). Stop when this part is done.

43b2 added `coverageSummary({ usHomes })` and `coverageNote({ coverage, budgetUsd, workplaceText, workplaceUnplaced }) → { lines, chips: [{ id, label }] }` in `web/src/homes.js`. Server `find_homes` now returns `coverage_note` for an empty US search. The chip ids are `meta`, `nocommute`, `budget` and `seoul`. This part shows the note in the browser.

## Code you need (`web/src/ui/chat.jsx`)
- `:3426-3458` `runSearch(prof, data, …)`: computes `emptyHint = usEmptyHint(...)` and pushes `data: { result, tenure, sort, emptyHint }`.
  - Bug: `CandidatesCard` receives `data.result` as its `data` (`:1492`), so `data.emptyHint` at `:557` is never set and the hint never shows.
- `:554-559` in `CandidatesCard`: `조건에 맞는 집이 없어요. 예산·크기·지역을 조금 넓혀 보세요.` then `data.emptyHint`.
- `:4201-4222` `appendToolCards`: a server `find_homes` result `r` becomes `data: { result: r, … }`, so `r.coverage_note` is already on `data`.
- `:1491-1506` `CardMsg` renders `<CandidatesCard … handlers={handlers}>`. The `handlers` object is built at `:4706`.
- `:3503` `handleTrayWorkplace(raw)`: resolves a workplace text (Meta HQ resolves through `findUsWorkplace`), sets the profile, and calls `liveResearch(next)`.
- `:3533` `handleTrayNoCommute()`.
- `:4317` `handleExample()`: the Korean example.
- `:3337` `liveResearch(prof)` re-runs the search.
- `:5395-5458` `StageArea({ …, profile, … })`: when there are no regions and no candidates, it always shows the Korean card `서울·경기 동남부` / `판교 · 분당 · …`.

## Change
1. **Rule flow puts the note on the result.** In `runSearch`, when the profile currency is `"USD"` and `result.candidates.length === 0`, set `result = { ...result, coverage_note }`:
   - `coverage_note = coverageNote({ coverage: coverageSummary({ usHomes: data.index.homes }), budgetUsd, workplaceText, workplaceUnplaced })`;
   - `budgetUsd` is the profile's `monthlyMax.value`;
   - `workplaceUnplaced` follows the same rule as 43b2: the first workplace has text, no `resolved`, and is not `noCommute`.

   Also move `emptyHint` onto `result`, so the existing line shows for the cases the note does not cover.
2. **Card.** When `data.coverage_note && data.coverage_note.lines.length > 0`:
   - render each line as `<Text>` instead of `조건에 맞는 집이 없어요…`, and drop `emptyHint` (the note already has the number);
   - under the lines, render one `Button size="sm" variant="secondary"` per chip (wrap row, 8 px gap token), calling `handlers.onCoverageChip(chip.id)`.
3. **Chip handler** (`onCoverageChip` in `handlers`):
   - `meta` → `handleTrayWorkplace("Meta HQ")`;
   - `nocommute` → `handleTrayNoCommute()`;
   - `budget` → set `monthlyMax` to the note's suggested value, then `liveResearch(next)` (store `suggestUsd` in the chip as `value` if 43b2 did not, or read it from `coverage_note`/`coverage`);
   - `seoul` → `handleExample()`.
4. **US map placeholder.** In `StageArea`, when `profile && profile.currency && profile.currency.value === "USD"`, the empty card shows:
   - heading `Caltrain 축 · 멘로파크`;
   - the line `대화에서 조건을 말하면 후보 지역이 여기에 표시돼요.`;
   - the US area names joined with ` · ` (`coverageSummary({}).usAreas`).

   Korean profiles keep the current card.
5. No `text-overflow`, no ellipsis, no 13 px. Korean source strings only; do not edit `web/src/i18n/*`.

## Tests — add to `web/tests/coverage-43b.test.js`
- Source checks (read `chat.jsx` as text, like other tests do):
  - `CandidatesCard` renders `coverage_note` lines and calls `onCoverageChip`;
  - `runSearch` no longer pushes `emptyHint` beside `result`;
  - `StageArea` has the `Caltrain 축 · 멘로파크` branch.
- If `CandidatesCard` can be rendered with `react-dom/server` the way other tests do (look at one existing test that imports `chat.jsx`), render it with `{ candidates: [], coverage_note: { lines: ["L1"], chips: [{ id: "meta", label: "Meta 본사(1 Hacker Way)로 하기" }] } }` and check that `L1` and the chip label appear and `조건에 맞는 집이 없어요` does not.
- Run only: `cd web && node --test tests/coverage-43b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/consult/*`, `web/src/i18n/*`, `web/src/places/*`, `web/src/render/*`.

## Final message
Changed files one line each, then the new Korean strings one per line.
