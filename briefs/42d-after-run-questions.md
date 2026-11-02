# Stage 42d — the questions people ask after a 30-day run get real answers, with or without Muse (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (list new Korean lines that need English in the final message). Builds on 42c (`personMonthLog`, `payload.personLog`) and 42b (no-answer alert).

## Why (owner: "유저가 다른 질문들을 한다고 했을 때, 그 질문들이 충분히 대응되는지")
Battery after the Korean demo run (판교 예비부부, homes 1·2, 30 days), local production build:

| # | Question | With Muse (first session) | Without Muse (429 `server_key_used`) |
|---|---|---|---|
| 1 | 배우자는 30일 동안 뭐 했어? | good (weekday/weekend pattern) | **no reply at all** |
| 2 | 밤 10시 넘어서 집에 온 날 있어? | **"확인된 기록이 없어서 말씀드리기 어려워요"** — the run has late returns (lifeEvents / runDigest `late`) but Muse cannot see them | no reply |
| 3 | B 집 출근길도 보여 줘 | good | no reply |
| 4 | 출근 지하철 많이 붐벼? | good | no reply |
| 5 | 둘 중 어디가 더 나아? | good (no winner) | no reply |
| 6 | 대출은 얼마나 받아야 해? | number dump, ok | no reply |
| 7 | 전세로 하면 어때? | ok | no reply |
| 8 | 주말에는 뭐 했어? | good | no reply |
| 9 | 근처에 공원이나 마트 있어? | good | no reply |
| 10 | 아이 생기면 학교는 가까워? | good | no reply |
| 11 | 3번 집이랑도 비교해 줘 | picks 3 but **does not run** the 3-home stay | picks 1 home only ("A 분당인텔리지2을 찜했어요… 지금 1곳") — wrong |
| 12 | 관리비 포함하면 한 달에 얼마야? | **"확인할 게 많아서 여기서 멈췄어요"** + number dump (step cap) | no reply |

Without Muse every free question leaves only the user's bubble — the 42a no-answer guard (`localNoAnswerLine`) did not fire for these turns; find out why (likely `answeredSince` counts a hidden/replaced message, or the server-key-used path returns before the guard).

## Change
1. **Never silent.** Every non-Muse turn ends with a visible assistant reply. Fix the guard so it counts only visible new assistant messages. The fallback line for questions the rules cannot answer: `이 질문은 Muse가 답해요. 위 알림에서 키를 넣으면 이어서 답해요.` (the 42b alert stays pinned).
2. **Rule answers for after-run questions** — `afterRunAnswer(text, { messages, picks, candidates, lang })` (extend 42a `afterRunChipReply`; Korean and English intents), all numbers from the latest done run payload (`personLog`, `lifeEvents`, `compare`, `moneyDoc`, `moments`), never invented:
   - person / weekend activity (`배우자|나|아내|남편|… 뭐 했어`, `주말`) → 2–3 lines from `personLog` for that person (weekday pattern, weekend outings with day numbers) + open the right stage on that person's first matching moment.
   - late return (`밤 N시|늦게|늦은 귀가|야근`) → days and times per home from the log (`A: 14일차 22:14 …`), or `30일 동안 밤 10시 넘어 들어온 날은 없었어요.` when none.
   - `A|B 집 출근길` → that home's commute scene on the right + its one-way minutes.
   - crowding (`붐벼|혼잡|사람 많`) → crowded minutes / peak % per home from `compare`.
   - which is better (`어디가 (더)? 나아|추천|골라 줘`) → no winner: 2 contrasts (commute, monthly cost) + `고르는 건 고객님 몫이에요.`
   - loan / monthly cost incl. 관리비 (`대출|한 달에 얼마|관리비`) → per home: loan amount, monthly repayment, 관리비, total — from `moneyDoc`; open the money tab.
   - 전세 → open the jeonse tab (existing flow).
   - nearby places / schools (`공원|마트|편의점|병원|학교|초등`) → if the candidate or run data already carries places/schools, list the nearest with walk minutes; otherwise open the tour scene and say `동네 3D를 열었어요. 가까운 장소 목록은 Muse가 찾아 줘요.`
   - `N번 집이랑도 비교해 줘` → add candidate N to the picks (keep A and B) and run the 3-home stay (`handleRun` with 3 ids). Same for Muse: when Muse's turn picks a third home in response to a compare request after a run, the run effect follows.
3. **Muse sees the run.** Build `runSummaryFor(payload)` (compact, ≤ 3 KB): per home → one-way commute avg/max day, crowded minutes, monthly cost lines (loan repayment, 관리비, 교통비, total), loan amount; per person → weekday pattern line, weekend outings (day + kind), late returns (day + time), longest day. Send it as `context.run_summary` from `askAgent` when a done run exists; `web/src/consult/agent.js` renders it into the context block (like `report_status`, `:~455`) with one instruction line: questions about the stay are answered from `run_summary` first, quoting its numbers, without extra tool calls. (Relay change — the orchestrator deploys it after approval.)

## Tests — new `web/tests/after-run-questions-42d.test.js`
- For each of the 12 questions above (Korean) and their English forms where listed: a synthetic done-run payload → a non-empty reply with numbers that exist in the payload, and the expected effect (scene / tab / run with 3 ids).
- No late returns → the "없었어요" line. Unknown question → the Muse fallback line.
- Guard: a non-Muse turn whose rule flow only replaces a hidden card still pushes the fallback.
- `runSummaryFor` ≤ 3 KB on a 2-home × 2-person × 30-day payload; agent context includes `run_summary` lines when given, none otherwise.
Run the new file + chat/consult/stage-run-42a/person-log-42c tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Why the 42a guard missed (one line), changed files one line each, new Korean lines needing English, suite line, build line.
