# Stage 43a — judges are never blocked by the one-session-per-IP rule (brief for Muse)

Agent mode, rules in `AGENTS.md` (read "Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit in your first tool call. Stop when this part is done.

## Why
41e/41k give each client IP one server-key chat session per 24 h. Judging runs Nov 5–8. Many judges sit behind one office egress IP, so after the first judge everyone else on that network gets `429 server_key_used` and is asked for their own key; so does a judge who opens a second conversation. The per-IP buckets (`consult10` 20 per 10 min, `consultDay` 100 per day) would also run out on a shared IP. The rubric asks "Does the product hold up live?", so none of this may fire for a judge.

## Code you need (read only these ranges)
- `relay/handler.js:120-160` — `memSessions`, `sharedSessions`, `serverKeySessionBlocked(client, session)`: stores one session string per IP; `recorded` → blocked when `session !== recorded`; first seen → `set(client, session, 86400)`.
- `relay/handler.js:236-240` — OPTIONS: `Access-Control-Allow-Headers: content-type, ${BYOK_HEADER}, ${SESSION_HEADER}`.
- `relay/handler.js:300-310` — voice: `checkBucket(voice10…)`, `checkBucket(voiceDay, client, t, DAY_MS, 40)`, `checkGlobal(voiceGlobal, t, DAY_MS, 300)`.
- `relay/handler.js:330-350` — consult: if no BYOK header → `serverKeySessionBlocked` → 429 `server_key_used`; then `Math.max(checkBucket(consult10, client, t, 600000, 20), checkBucket(consultDay, client, t, DAY_MS, 100), checkGlobal(consultGlobal, t, DAY_MS, 600))`. `checkGlobal` is at `:93`. The Baseten cap `checkGlobal(consultGlobalBaseten, t, DAY_MS, 150)` follows (`:366`).
- `relay/session-store.js` (whole file, 55 lines) — `get(client)` returns one session string (cache value `{ session, t }` or a bare string; memory fallback); `set(client, session, ttl)`.
- `web/src/ui/consult-client.js:16-27` — `sessionHeaders()` adds `x-ithaca-session` (from `web/src/chat/session-id.js`).
- `web/src/ui/voice.js:161` — the `/api/voice/transcribe` fetch.

## Change
1. **Judge code, server.**
   - `env.JUDGE_CODES`: comma-separated; trim each; keep only codes ≥ 12 chars; none → feature off.
   - Header `x-ithaca-judge`: add to the OPTIONS allow-headers.
   - `isJudge(req)`: constant-time compare of the trimmed header against each code (compare lengths first, then a byte XOR loop; no early return inside the loop). A wrong or short code counts as no code.
   - Consult with a valid code: skip `serverKeySessionBlocked` **and** the two per-IP buckets. Use `checkGlobal(consultJudge, t, DAY_MS, 400)` plus the existing `consultGlobal` 600 cap. The Baseten 150 cap still applies.
   - Voice with a valid code: skip the two per-IP voice buckets; keep `voiceGlobal`.
   - Never put the code (or "judge") in any response body, header or log line.
2. **Judge code, client** (new small module `web/src/chat/judge-code.js`, Node + browser safe like `session-id.js`).
   - `captureJudgeCode()` runs once on app start (call it where `session-id.js` is first used, or in `main.jsx` before render). If `location.search` has `judge`, store it in `sessionStorage` (`ithaca.judge`, try/catch). Then remove only that parameter with `history.replaceState`, keeping `lang`, `chat` and the hash.
   - `judgeHeaders()` returns `{ "x-ithaca-judge": code }` or `{}`. Merge it into `sessionHeaders()` in `consult-client.js` and into the voice fetch headers.
   - Nothing changes in the UI.
3. **More sessions per IP for everyone (env, default unchanged).**
   - `env.SESSIONS_PER_IP`: integer, default 1, clamp 1–10.
   - Session store value becomes `{ sessions: [id, …], t }`. `get(client)` returns an array: an old `{ session }` value or a bare string becomes `[session]`; nothing stored → `[]`. `set(client, sessions, ttl)` writes the array. The memory fallback keeps the same shape.
   - `serverKeySessionBlocked`: id already in the list → allowed. New non-empty id and `list.length < N` → append, allowed. Otherwise blocked. A missing id is blocked when the list is non-empty (same as today).
   - The per-IP day bucket scales: `checkBucket(consultDay, client, t, DAY_MS, 100 * N)`.

## Tests
- New `web/tests/judge-access-43a.test.js`, driving the handler like `server-key-once-41e.test.js`:
  - `JUDGE_CODES=abcdefghijkl`: IP 1.1.1.1 session "a" allowed; session "b" + header `abcdefghijkl` allowed; session "c" + header `wrongcode123` → 429 `server_key_used`; a short code `abc` in env is ignored.
  - With a valid code, 25 consult calls in 10 min from one IP are not limited by `consult10`.
  - `SESSIONS_PER_IP=3`: sessions a, b, c from one IP allowed, d → 429; a stored old-format `{ session: "a" }` still allows "a"; `SESSIONS_PER_IP=99` behaves as 10.
  - OPTIONS lists `x-ithaca-judge`; no response body or header contains `abcdefghijkl`.
  - `captureJudgeCode` with a fake `location`/`history`/`sessionStorage`: stores the code, and the replaced URL keeps `lang=en` and has no `judge`.
- `web/tests/session-store-41k.test.js`: update only the assertions that read the stored shape (now an array). Keep every `it(` block.
- Run only: `cd web && node --test tests/judge-access-43a.test.js tests/server-key-once-41e.test.js tests/session-store-41k.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
- If a test still fails after 2 fix attempts, stop and print the last lines of the failure.

## Do not touch
`web/src/places/*`, `web/src/render/*`, `web/src/ui/candidate-card.jsx`, `web/src/i18n/*`.

## Final message
Changed files, one line each. Nothing else.

## Orchestrator after merge (not for Muse)
- Vercel production env: `JUDGE_CODES=<one random 16+ char code>`, `SESSIONS_PER_IP=3`. Relay redeploy needs the owner's approval (they run it).
- The link `https://halo-sw.github.io/ithaca/?judge=<code>&lang=en` goes **only** into the private submission form. Never into the README, the video or an X post.
- The landing caption says "무료 체험 1회 / One free try". With `SESSIONS_PER_IP=3` that understates the allowance. Leave it, or change the i18n text with the owner's OK.
- Check that the Meta API and Baseten credits cover about 400 judge calls plus 600 public calls a day through Nov 8.
