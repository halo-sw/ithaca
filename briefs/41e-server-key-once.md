# Stage 41e — server model key: one session per IP, then the visitor's own key (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Parallel runs 41a/41b/41c touch i18n, consult/*.js, profile.js, money.jsx, candidate-card.jsx: touch only `relay/handler.js`, `web/src/ui/chat.jsx` (the consult request + the limit notice), `web/src/ui/model-panel.jsx` if needed, one new small client module, and tests.

## Why
Owner decision (2026-11-01): the relay's own model key (Muse Spark 1.3, `META_API_KEY`/`MODEL_API_KEY`) is restored, but **each IP may use it for one chat session only; after that, the visitor is asked to switch to their own key** (BYOK already exists: header `x-model-key`, `web/src/consult/byok.js`, key entry in `web/src/ui/model-panel.jsx`). Today `/api/consult` (`relay/handler.js:280-312`) allows 20 calls / 10 min and 100 / day per IP on the server key.

## Changes
1. Client session id: the browser makes one random id per chat session (new conversation = new id; keep it in `sessionStorage`, never in the URL) and sends it on every `/api/consult` request as header `x-ithaca-session`. Add the header to the relay's CORS allow list (`relay/handler.js:191`).
2. Relay (`/api/consult`, server key only — requests carrying `x-model-key` are not limited by this rule, keep their current buckets):
   - Remember, per client IP (`clientKey`), the first session id that used the server key (in-memory map with a 24 h TTL, like the existing buckets; cap the map size).
   - Same IP + same session id → allowed (the existing per-IP buckets still apply).
   - Same IP + a different session id within 24 h → `429 { ok: false, error: "server_key_used", byok: true }` with no model call.
   - A request without `x-ithaca-session` on the server key is treated as its own new session (so it is refused if the IP already used one).
3. Client: on `server_key_used`, show one plain notice in the chat (Korean: "무료 체험 대화는 한 번만 쓸 수 있어요. 계속하려면 내 모델 키를 넣어 주세요." with a button labelled "내 모델 키 넣기" that opens the existing model-key panel; English via the i18n table — the orchestrator adds the row) and do not retry. Rule-mode features (recorded chats, the rule path) keep working.
4. Recorded/replay paths and `/api/model/status` are unchanged.

## Tests — new `web/tests/server-key-once-41e.test.js` (drive the handler the way existing relay tests do)
- IP 1.1.1.1 session "a" → allowed twice; session "b" → 429 `server_key_used`; IP 2.2.2.2 session "c" → allowed.
- With `x-model-key` present, session "b" from 1.1.1.1 is allowed.
- Without `x-ithaca-session`, a second request from 1.1.1.1 after session "a" → 429.
- CORS preflight allows `x-ithaca-session`.

Run only:
```
cd web && node --test tests/server-key-once-41e.test.js $(ls tests/*relay*.test.js 2>/dev/null | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```

## Final message
Changed files, one line each, plus the exact Korean notice text.
