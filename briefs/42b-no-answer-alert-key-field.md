# Stage 42b — when Muse cannot answer, say so where it matters and offer the key field there (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` (list new Korean lines that need English in the final message).

## Why (owner, 2026-11-02)
"답이 없을 때는 서비스에서 해당 부분에 대한 알럿 메시지를 줬으면 좋겠어." and "키 없이 바로 재생이 들어갈 게 아니라, key가 있어야 한다면 key를 입력할 수 있는 필드를 등록하게끔 해 놔야 맞을 것 같아."

Today, on a second browser session from one IP (relay `429 server_key_used`, 41e/41k) the only signal is one system line at the top of the thread (`SERVER_KEY_USED_LINE` + a `내 모델 키 넣기` button, `web/src/ui/chat.jsx:~2200`, `~3823`). It scrolls away after the first card. From then on every answer is the rule flow with no mark; the diary silently says "일기는 이번에 못 썼어요"; the report says "리포트 검증을 하지 못했어요 (연결 문제)". The owner reads that as "the service is broken". Same for keyless servers (`noticeKeylessOnce`) and after 3 Muse failures.

## Change
1. **Pinned alert above the composer** (chat screen, both layouts) while Muse is not answering — state = server key used, keyless, or the 27j failure count ≥ 1 on the latest turn. Use the design-system `Banner`/alert already used in chat (status `warning`), not a chat bubble. Text by cause:
   - server key used: `Muse가 지금 답하지 못해요. 이 네트워크의 무료 체험(1회)을 이미 썼어요. 지금은 정해진 규칙으로만 답해요.`
   - keyless: `Muse 키가 없어서 정해진 규칙으로만 답해요.`
   - failures: `Muse 연결이 안 돼서 이번 답은 규칙으로 했어요.`
   Below the text, **the key field inline**: provider choice (`Muse Spark 1.3 · Meta` / `Muse Spark Open · Baseten`), a password input, `키 저장` button — the same storage as `ModelPanel` (`web/src/consult/byok.js` `saveByoKey` into sessionStorage; never localStorage, never logged, never in a URL). After saving: the alert turns into a short success line `키를 저장했어요. 다음 말부터 Muse가 답해요.` and the next turn goes to Muse (clear the server-key-used / keyless / failure state for that provider; the 41e relay already exempts BYOK). A small `닫기` hides the alert for the session (it comes back on the next non-Muse turn). Show `키는 이 탭에만 저장돼요` as one supporting line.
2. **Mark rule answers.** Assistant text that did not come from the model (`fromModel` false on the non-Muse paths) shows the small meta line `규칙으로 답했어요` where Muse answers show `Muse Spark 1.3` — so every bubble says who answered.
3. **Diary and report say why, with a way forward.** When the diary fails because Muse is unavailable, the result card's diary area shows `일기는 Muse가 써요. 키를 넣으면 다시 쓸 수 있어요.` with an `일기 다시 쓰기` button (re-runs `postDiary` with the same digests; disabled until a key is saved or the server key works again). The report's failed line becomes `리포트 검증은 Muse가 해요. 지금은 연결이 안 돼서 하지 못했어요.` (keep `다시 검증하기`).
4. **Landing `바로 해 보기` card** (`web/src/ui/landing-page.jsx:~205-225`): the two live buttons keep `Muse 실시간`, and their caption becomes `무료 체험 1회 · 이후 내 키`. Under the three buttons add a collapsed row `내 모델 키로 하기 ▸` that opens the same inline key field (provider + password + 저장, same sessionStorage). The replay button stays (it needs no key) with its caption `키 없이 기록 재생`.

## Tests — new `web/tests/no-answer-alert-42b.test.js` (pure helpers; export what you need)
- `noAnswerAlertFor({ serverKeyUsed, keyless, fails })` → the right text per cause, null when Muse answered.
- Saving a key through the alert's handler writes sessionStorage via `saveByoKey` and clears the alert state for that provider; nothing goes to localStorage.
- A rule answer message renders the `규칙으로 답했어요` meta line; a Muse answer keeps the model name.
- Diary failed with Muse unavailable → the new line + `일기 다시 쓰기` button; report failed → the new line.
- Landing captions: `무료 체험 1회 · 이후 내 키`, `키 없이 기록 재생`; the key row exists and is collapsed by default.
Run the new file + chat/landing/model-panel tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, new Korean lines needing English, suite line, build line.
