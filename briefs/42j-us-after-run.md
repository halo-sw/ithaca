# Stage 42j — after-run answers for the US region and English; richer run_summary (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (battery on the 42i build, local production copy)
English UI, US region: `We're a couple, both working at Meta HQ in Menlo Park. We want to rent, up to $6,000 a month.` → save 1, 2 → 30 days → 13 questions.
1. **Romanized person names**: `Baeuja: On weekdays you usually left around 08:00…`, `Weekends — Na: day 6 … ; Baeuja: …`. English must say `You` / `Your partner` (member labels from the profile, translated — never romanized Korean), with matching grammar (`Your partner usually left around 08:00, got to work around 08:14 and was home around 17:28.`).
2. **Wrong currency**: `Monthly housing: A 777 Hamilton 4,261 won, B 205 Marshall Street 4,678 won.` US homes are monthly rent in USD → `$4,261`. Check every after-run answer, `run_summary`, the compare/money lines and the 30-day log for US runs: USD for US homes, won for Korean homes, by the home's region (not the UI language).
3. **Money questions unanswered for US rent**: `How much do we pay a month?` and `How much a month including utilities?` → rules: `I can do that once Muse reconnects.`; with Muse: `I couldn't finish an answer this time.` Recognise English money intents (`how much … a month`, `monthly cost`, `rent`, `utilities`, `pay a month`, `total`) in both regions, and answer US homes from the run's own numbers: rent `$X/mo`, commute cost (Caltrain fare / shuttle as the run models it), total. Utilities: only if the data has a number; otherwise say plainly they are not included in the listing data. No invented numbers.
4. **Deposit question on US homes**: rules open the Korean `deposit-lease` (전세) tab — meaningless for US rentals. For US homes answer `These are monthly rentals; the Korean jeonse deposit doesn't apply. The listings don't include a security deposit amount.` (Korean UI: `미국 집은 월세라 전세 보증금이 없어요. 매물 자료에 보증금 금액은 없어요.`) and do not open the jeonse tab.
5. **`Show more homes` (rules, US)** still gets the fallback `I can do that once Muse reconnects.` Find why the 42h/42i more-candidates path does not run for a US profile (`isMoreCandidatesRequest`, stored profile, `profileHasValues`, `ensureData` region, `runSearch` limit) and fix it so it re-runs the US search with the larger limit and says the count line.

Korean UI, 강남 example (`강남역으로 출근하는 맞벌이 부부예요. 둘 다 강남에서 일하고, 모은 돈 3억, 9억 이하 매매로 찾아 줘`), with Muse:
6. Muse said `배우자분은 평일 진료 일정 중심으로 지내셨어요` (the record has a 07:45 commute to 강남 on every workday) and `주말만 따로 구분된 기록은 요약에 없어요`. `runSummaryFor` must carry, per home and per member: the weekday pattern (typical leave / arrive / home times, or "mostly home" with outing counts — the same data as the 42e pattern line) and the weekend outings by calendar day (`6일차(토) …`). English summary for English UI; amounts in the home's currency.

## Tests — new `web/tests/us-after-run-42j.test.js`
- English member labels: `You` / `Your partner`, no `Na` / `Baeuja` / Hangul romanization in any after-run English answer.
- US run fixture: money/compare/run_summary lines use `$` and no `won`; Korean fixture keeps `원`.
- English money intents recognised (list above); US answer has rent, commute cost, total; utilities line says not included when absent.
- Deposit question on US homes → the monthly-rent line, no jeonse tab effect; Korean homes unchanged.
- Rule path `Show more homes` with a stored US profile → re-run + count line, no fallback.
- `runSummaryFor` includes per-member weekday pattern and weekend outings with weekday names.
Run the new file + 42d/42e/42h/42i tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Cause of item 5 in one sentence, changed files one line each, suite line, build line.
