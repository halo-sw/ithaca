# Stage 45a — the free trial is 3 sessions a day per network, say so (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Why
The relay now runs with `SESSIONS_PER_IP=3`: each network gets 3 server-key chat sessions, and the list clears 24 hours after the third one starts (`relay/handler.js`, `serverKeySessionBlocked`). The screen still says one try.

## Change — replace these Korean strings exactly (nothing else in these files)
| file | old | new |
| --- | --- | --- |
| `web/src/ui/no-answer-alert.js` (line 84, `LANDING_TRIAL_CAPTION`) | `무료 체험 1회 · 이후 내 키` | `무료 체험 하루 3회 · 이후 내 키` |
| `web/src/ui/entry-hero.jsx` (line 125, inside `ds-lp-judgecap`) | `무료 체험 1회 · 이후 내 키 · ` | `무료 체험 하루 3회 · 이후 내 키 · ` |
| `web/src/ui/no-answer-alert.js` (line 7, `serverKeyUsed`) | `Muse가 지금 답하지 못해요. 이 네트워크의 무료 체험(1회)을 이미 썼어요. 지금은 정해진 규칙으로만 답해요.` | `Muse가 지금 답하지 못해요. 이 네트워크의 오늘 무료 체험 3회를 다 썼어요. 지금은 정해진 규칙으로만 답해요.` |
| `web/src/ui/chat.jsx` (line 2879, `SERVER_KEY_USED_LINE`) | `무료 체험 대화는 한 번만 쓸 수 있어요. 계속하려면 내 모델 키를 넣어 주세요.` | `무료 체험 대화는 하루 3번까지예요. 계속하려면 내 모델 키를 넣어 주세요.` |

Use one `sed -i ''` per string or a single-line edit; do not reformat the files.

## Tests
These existing tests assert the old text. In each, replace only the old string literal with the new one (same `sed`), do not touch any other line:
- `web/tests/landing-judge-30e.test.js:55`, `try-card-42k.test.js:46`, `landing-hero-29a10.test.js:38`, `first-screen-26w.test.js:79`, `entry-hero-42g.test.js:20,69,83`, `no-answer-alert-42b.test.js:169,171` — `무료 체험 1회 · 이후 내 키` → `무료 체험 하루 3회 · 이후 내 키` (keep the regex form where it is a regex).
- `web/tests/no-answer-alert-42b.test.js:24` — `무료 체험(1회)을 이미 썼어요` → `무료 체험 3회를 다 썼어요`.

Add a new `web/tests/three-tries-45a.test.js`: the source of `no-answer-alert.js`, `entry-hero.jsx` and `chat.jsx` has no `무료 체험 1회`, no `무료 체험(1회)` and no `한 번만 쓸 수 있어요`, and `LANDING_TRIAL_CAPTION` equals `무료 체험 하루 3회 · 이후 내 키`.

Run only: `cd web && node --test tests/three-tries-45a.test.js tests/landing-judge-30e.test.js tests/try-card-42k.test.js tests/landing-hero-29a10.test.js tests/first-screen-26w.test.js tests/entry-hero-42g.test.js tests/no-answer-alert-42b.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If a test still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*`, `web/src/i18n/*`, any other file.

## Final message
Changed files one line each.
