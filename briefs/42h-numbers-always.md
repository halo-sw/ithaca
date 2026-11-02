# Stage 42h — stay questions always end with the record's numbers; "N번 집이랑도 비교" always runs; typed "다른 후보 더 보여 줘" works without Muse (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (42f battery, local production build, Korean demo, homes A/B after the 30-day run)
With Muse (first session):
- `관리비 포함하면 한 달에 얼마야?` → `돈 화면에 두 집의 한 달 내역을 정리해 두었어요. 화면에서 함께 확인해 보시면 좋겠어요.` (no number)
- `출근 지하철 많이 붐벼?` → `이번 대화에서 확인된 수치가 없어 말씀드리기 어려워요.` (the rule answer has it: `서서 간 출근은 없었어요` per home)
- `3번 집이랑도 비교해 줘` → `…찜에 넣어드릴까요?` (no pick, no run)
- Rule answers used on a Muse-fallback turn end with an inline `(규칙으로 답했어요.)` **and** the meta line `규칙으로 답했어요` — said twice.
Without Muse:
- `다른 후보 더 보여 줘` (typed) → `이 요청은 Muse가 다시 연결되면 할 수 있어요.` — the card button `다른 후보 6곳 더 보기` already does this without Muse.

## Change
1. **Numbers always land.** After a Muse turn, if `afterRunAnswer(text)` recognises a stay intent that has data (money / loan / 관리비, crowding, late return, person / weekend activity, a home's commute) and Muse's visible text contains no digit, push the rule answer right after Muse's bubble (one extra bubble, meta `규칙으로 답했어요`, its tab/scene effect only if Muse opened none).
2. **Compare-add is an action, not a question.** `N번 집이랑도 비교해 줘` / `N번도 같이 살아 봐 줘` / `add home N to the comparison` after a done run is handled before the Muse call in both modes: add candidate N to the picks (keep A, B), run the 3-home stay, one line `{name}을(를) 담아 세 집으로 살아 볼게요.` (particle by the final consonant, 42a2 helper). Muse is not asked.
3. **Typed "more candidates" without Muse.** `다른 후보 더 보여 줘 | 더 보여 줘 | 다른 집 더 | show more homes` on the rule path call the same handler as the candidate card's `다른 후보 N곳 더 보기` button.
4. Remove the inline `(규칙으로 답했어요.)` / `(answered by rules.)` suffix from rule answer texts — the meta line already says it.

## Tests — new `web/tests/numbers-always-42h.test.js`
- Muse reply without digits + money/crowding question on a done run → the rule answer is appended; Muse reply with digits → nothing appended; unrelated question → nothing appended.
- `3번 집이랑도 비교해 줘` with a done run → handled pre-Muse: picks [A, B, #3], run with 3 ids, the line (particle right for `분당인텔리지2` → no-particle or `를` form per helper).
- Typed `다른 후보 더 보여 줘` on the rule path → the more-candidates handler runs; no Muse-fallback line.
- No rule answer text contains `(규칙으로 답했어요` or `(answered by rules`.
Run the new file + 42d/42e/42f tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.
