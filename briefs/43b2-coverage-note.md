# Stage 43b2 — coverage note: server find_homes + pure reply builder + profile line (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the line ranges named here. Stop when this part is done.

Context: `briefs/43b-coverage-answer.md` (do not re-read it; everything needed is here). 43b1 already added `coverageSummary({ usHomes })` in `web/src/homes.js` (after `usEmptyHint`, ≈ lines 85–108). It returns `{ usAreas, commuteTo, minMonthlyUsd, minMonthlyArea, suggestUsd }`. The import lines in `web/src/chat/engine.js:22` and `web/src/consult/tools-search.js:28` are already there.

Facts: the cheapest US home in the data is $3,541/mo (Redwood City). US commutes exist only to Meta HQ in Menlo Park, so an unknown US workplace cannot get minutes.

## 1. Pure reply builder — `web/src/homes.js`, right after `coverageSummary`
`export function coverageNote({ coverage, budgetUsd, workplaceText, workplaceUnplaced })` returns `{ lines: string[], chips: { id, label }[] }` (Korean source strings; the app translates them):
- `workplaceUnplaced` true:
  - line `미국은 Meta 본사(멘로파크)까지 출퇴근만 계산해요. ${workplaceText}까지 시간은 아직 없어요.`
  - chips `{ id: "meta", label: "Meta 본사(1 Hacker Way)로 하기" }` and `{ id: "nocommute", label: "출퇴근 없이 집 보기" }`.
- `budgetUsd` finite and `coverage.minMonthlyUsd > budgetUsd`:
  - line `Caltrain 축 ${first}–${last} 지역을 다뤄요. 가장 낮은 월세는 ${fmtMoney(min,"USD")}(${minMonthlyArea}, Zillow ZIP 추정)라 예산 ${fmtMoney(budgetUsd,"USD")}보다 높아요.`
  - chip `{ id: "budget", label: \`${fmtMoney(suggestUsd,"USD")}까지 보기\` }`.
- Always add `{ id: "seoul", label: "서울 예시로 해 보기" }` when any line was added.
- Order: the workplace line first.
- Nothing applies → `{ lines: [], chips: [] }`.

## 2. Server `find_homes` — `web/src/consult/tools-search.js:297-309`
When the profile is US (`isUsProfile(profile, …)`, defined at `:200`) **and** `final.candidates.length === 0`:
- Add `coverage: coverageSummary({ usHomes })`, using the US homes this call already loaded (`needUsHomes(session)` → `{ homes }`, `:207`).
- Add `coverage_note: coverageNote({ coverage, budgetUsd, workplaceText, workplaceUnplaced })`:
  - `budgetUsd` is the profile's `monthlyMax.value`;
  - `workplaceUnplaced` is true when the first workplace has `text`, no `resolved`, and is not `noCommute`.
- Replace the empty-case `next` with `"say why in one or two sentences using coverage_note lines and coverage numbers only, then mention the chips"`.

`toolResultNumbers` (`guards.js:508`) then accepts these numbers with no guard change.

## 3. Profile line — `web/src/chat/engine.js:505-513`
`${where}${w.resolved ? "" : " (모름)"}` → for an unresolved workplace in a USD profile (`currencyOf(...)` / profile currency `"USD"`), write `${where} · 출퇴근 계산 안 됨`. Korean profiles keep ` (모름)`.

## Tests — fill `web/tests/coverage-43b.test.js` (currently a placeholder)
- `coverageSummary` on 3 fixture US homes (`{ currency: "USD", region: "us-st-redwood-city", buckets: [{ wolse: { monthly: { median_won: 3541 } } }] }` etc.):
  - 8 `usAreas`;
  - `minMonthlyUsd` 3541, area `Redwood City`;
  - `suggestUsd` 3600.
- `coverageNote`:
  - unplaced workplace + $3,500 → 2 lines (workplace first), chips `meta, nocommute, budget, seoul`;
  - placed + $5,000 → empty.
- `toolResultNumbers([{ coverage, coverage_note }])` contains 3541 and 3600.
- Profile line (the engine function that contains `:505-513`): USD profile, workplace `{ text: "Google in Mountain View" }` → has `출퇴근 계산 안 됨` and no `(모름)`.
- Run only: `cd web && node --test tests/coverage-43b.test.js tests/consult-guards.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/ui/*` (next part), `web/src/i18n/*`, `web/src/places/*`, `web/src/render/*`.

## Final message
Changed files one line each, then the new Korean strings one per line.
