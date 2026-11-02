# Stage 42f — after a run, unknown text still reaches the rule flow; the key button is never cut (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (local check after 42d, Muse unavailable)
1. After a done run, `다른 후보 더 보기` (the candidate card's button) got `이 질문은 Muse가 답해요. 위 알림에서 키를 넣으면 이어서 답해요.` — `afterRunAnswer` (`web/src/ui/chat.jsx:~2141`) returns the Muse fallback for any text it does not recognise (`:~2170`, `:~2208`, `:~2229`), and the caller (`:~2856`) returns before `structuredFlow` runs. So after a run every rule the app already had — more candidates, a new search (`강남으로 다시 찾아 줘`), sort chips, `전세 점검`, `도움 제도`, picks/runs by number, listing paste — is blocked.
2. The 42b key field's save button renders as `키 …` (cut) in the 500 px thread column. Truncated labels are not allowed in this app.

## Change
1. `afterRunAnswer` returns `null` for text it does not recognise (and for a recognised intent with no data, keep its specific line only when that line is a real answer). The caller then falls through to the existing flow (`structuredFlow` and the rest of `send`). The Muse fallback line is used only by the visible-reply guard at the end of a non-Muse turn when nothing visible was added (42d `countsAsVisibleReply`).
2. Key field row: the save button keeps its full label `키 저장` (`Save key`) at every thread width — let the input shrink, or wrap the button under the input on narrow widths; no ellipsis, no `text-overflow`.

## Tests — extend `web/tests/after-run-questions-42d.test.js` (or a new `after-run-passthrough-42f.test.js`)
- After a done run: `afterRunAnswer` → `null` for `다른 후보 더 보기`, `강남으로 다시 찾아 줘`, `월세 낮은 순`, `전세 점검`, `3번 담아 줘`, `Show more homes`; still answers the 12 battery questions.
- The send path for a non-Muse turn with unknown text after a run calls the rule flow (no fallback line when the rule flow replied; fallback line when it did not).
- The key field's save button: no ellipsis style; label present in full (render/static check of the class/CSS you use).
Run the file + 42b/42d tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.
