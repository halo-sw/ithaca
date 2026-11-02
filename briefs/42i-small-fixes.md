# Stage 42i — three small fixes from the 42h battery (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

1. **Typed `다른 후보 더 보여 줘` without Muse**: the 42h branch (`web/src/ui/chat.jsx:~3088`) re-runs the search and the candidates card updates, but the card is pushed with `replace: true`, so `countsAsVisibleReply` (`:~1572`) does not count it and `localNoAnswerLine` adds `이 요청은 Muse가 다시 연결되면 할 수 있어요.` underneath. After the re-run push one short line `후보를 {N}곳으로 늘려 지도에 올렸어요.` (en `Showing {N} homes on the map now.`, N = the new candidate count) so the turn has its visible reply and no fallback.
2. **Compare-add line shows a raw id**: with Muse, `3번 집이랑도 비교해 줘` produced `(84-0) 담아 A 백궁 동양파라곤, B 수서현대벤쳐빌, C (84-0) 세 집으로 살아 볼게요.` Use the same display name the candidate card shows (`displayNameFor` / the card's title, English via `homeNameEn`) for the line and the labels; a name that is only a parenthesised id falls back to `{N}번 집`.
3. **One placeholder**: the chat empty state's composer says `예: 판교로 출근해요. 전세로 혼자 살 집 찾아 줘`; the landing says `판교 출근, 모은 돈 1억, 4억 이하 매매로 혼자 살 집 찾아 줘`. Both use the landing's text (one shared constant in `entry-hero.jsx`).

## Tests — new `web/tests/small-fixes-42i.test.js`
- Rule path `다른 후보 더 보여 줘` with a stored profile → the count line, no fallback line.
- Compare-add line with a candidate named `(84-0)` and display name `○○빌` → uses `○○빌`; with no usable name → `3번 집`.
- Landing and chat empty state share the placeholder constant.
Run the new file + 42f/42h/42g tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.
