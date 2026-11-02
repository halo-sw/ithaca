# Stage 42e — "둘 다 판교에서 일하는" means both commute; weekends from the run calendar; Muse answers stay questions with the numbers (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (42d question battery, local production build, Korean demo)
Sentence: `판교에서 둘 다 일하는 예비부부예요. 연봉은 6천만 원, 5천만 원이고 모은 돈은 2억 원이에요. 7억 원 이하로 50㎡ 이상 집을 사고 싶어요.` → homes 1·2 → 30 days.
1. **The partner never commutes.** Rule answer: `배우자님은 평일에 주로 웰츠약국 진료 지냈어요.` Muse (reading `run_summary`): `배우자분은 평일에는 진료 다녀오시는 일정으로 지내셨어요.` The 3D at `1일차 08:19` shows 배우자 at home. Both members work in 판교 (41l: the shared-workplace rule). Find where the second adult loses the commute — `extractProfile` (members / workplaces), `scenarioFromProfile` (`web/src/profile.js:~1300`, `workplaces[i] || workplaces[0]`, `stationName`), or the engine — and fix it so every working adult with a workplace commutes on workdays. Also check the English sentence (`We're an engaged couple, both working in Pangyo. …`) and the Meta HQ example (two adults).
2. **Weekends are wrong.** Rule answer `주말 외출은 2일차 17:38 장보기 …` — day 1 is 11월 2일(월), so day 2 is Tuesday. The person-log / after-run code must take each day's weekday from the run calendar (the same one the day strip uses: `{월} {일}({요일}) · N일차/30`), never assume day 1 = Saturday or similar.
3. **Weekday pattern line reads badly**: `평일에 주로 웰츠약국 진료 지냈어요`. Commuter → `평일에는 07:37쯤 나가서 판교 회사에 08:19쯤 도착하고, 18:42쯤 집에 왔어요.` (typical times = median of the workday records). Non-commuter → `평일에는 주로 집에 있었고, 장보기 4번·진료 2번 다녀왔어요.`
4. **Muse deflects with the numbers in hand.** With `run_summary` in context: `출근 지하철 많이 붐벼?` → "요약에 붐비는 정도가 담겨 있지 않아"; `관리비 포함하면 한 달에 얼마야?` → "비교 화면의 카드에서 확인해 보시겠어요?". Add crowding to `runSummaryFor` (crowded minutes standing, peak congestion % per home, from `compare` / runs) and make the agent context line explicit: stay / money / crowding questions are answered in 2–3 sentences quoting the summary numbers; never send the customer to the cards instead of answering.
5. **Muse's empty turn hides a good rule answer.** `대출은 얼마나 받아야 해?` with Muse ended in the generic fallback `도구가 낸 수치만 정리했어요 … 이번 대화의 도구 결과에 수치가 없어요.` When a Muse turn ends in that fallback (`out.fallback`) and `afterRunAnswer` has an answer for the text, show the rule answer instead (marked `규칙으로 답했어요`).

## Tests — new `web/tests/both-commute-42e.test.js`
- Demo sentence (ko) and the English sentence → scenario has two adult members, both with a commute work block to 판교; a short engine run (or the scenario-level check you can do without the full engine) → both have work aways on Mon–Fri.
- Weekday per day from the calendar: a run starting Monday → days 6,7,13,14 weekend; day 2 weekday; summary/answers name only weekend days.
- Weekday pattern line for a commuter and a non-commuter (texts above, numbers from records).
- `runSummaryFor` includes crowding per home; agent context contains the new instruction.
- Muse fallback turn + an after-run question → rule answer shown.
Run the new file + 42c/42d/profile tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Cause of item 1 in one or two sentences, changed files one line each, suite line, build line.
