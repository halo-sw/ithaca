# Stage 41f — Muse Spark Open runs live in the product (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Stop when this part is done.

This is the owner's brief 38a, renumbered to run **after 41e** (both edit `relay/handler.js` and `web/src/ui/chat.jsx`). 41e is already in the tree when you start: keep its session rule.

## Why
Muse Spark Open (`meta-models/muse-spark-open-1026` on Baseten) is wired in `web/src/judge/providers.js` (`PROVIDERS.baseten`). Today it only runs offline in the judge CLI comparison (`scenarios/decisions/compare-1029/`). Visitors can never reach it: `relay/handler.js` `/api/consult` answers `400 provider` to any body whose `provider` is not `"meta"` unless the BYOK header is set, and `/api/model/status` hard-codes `baseten: { hasServerKey: false }`. The product should let anyone run the same consult on the open-weights model, with a safe budget.

## Change
1. `relay/handler.js`:
   - `/api/consult`: allow `provider === "baseten"` without BYOK **when the server env has `BASETEN_API_KEY`**. Keep `400 provider` for any other value, and for `baseten` when the key is missing.
   - A separate global day bucket for baseten: `checkGlobal(consultGlobalBaseten, t, DAY_MS, 150)`. Over the cap → `429 { ok:false, error:"open_limit" }`.
   - The 41e rule (one session id per IP on the server key, then `server_key_used`) covers **both** server keys: a session that started on Spark 1.3 may switch to Spark Open and back; a second session from the same IP gets `server_key_used` on either provider. BYOK requests stay exempt.
   - `/api/model/status`: `baseten: { hasServerKey: Boolean(env.BASETEN_API_KEY) }`. Booleans only, never key text. (No new endpoint: the client already reads this one.)
2. `web/src/consult/agent.js`: no change in logic. Confirm that `provider` from the request body reaches `providerConfig(provider)` and `completeWithTools`. If Baseten rejects `reasoning_effort` or `json_schema`, the existing omission path in `providers.js` already handles it. Add a test that proves it.
3. UI (`web/src/ui/powered-by-muse.jsx` and the chat request builder in `web/src/ui/chat.jsx`, `const [provider, setProvider] = useState("meta")` ≈ line 1863):
   - Turn the header model label ("● Muse Spark 1.3") into a two-item `SegmentedControl` (the existing Astryx one): **Muse Spark 1.3** | **Muse Spark Open · open weights**. Show the second item only when `/api/model/status` says `baseten.hasServerKey: true`. Rule mode (no server key) keeps today's label.
   - The choice is sent as `provider` on every `/api/consult` call (chat, report, diary) for the rest of the session. Keep it in `sessionStorage`, wrapped in try/catch.
   - Every assistant reply shows a small tag under the message with the model that answered (`providerLabel(provider)`: "Muse Spark 1.3" / "Muse Spark Open"). Recorded replays keep the model they were recorded with.
   - On `open_limit` or any baseten error: retry that turn once with `provider:"meta"` and show one line: "Muse Spark Open is busy, so this answer used Muse Spark 1.3." (Korean: "Muse Spark Open이 바빠서 이번 답은 Muse Spark 1.3이 했어요."). `server_key_used` is not retried (41e notice).
   - At 390 px the control must fit the header without overflow; if it does not, show it inside the existing model panel instead of the header and keep a compact label in the header.
4. Copy: "오픈 웨이트 모델(Muse Spark Open)로 같은 상담을 돌려 볼 수 있어요" as the control's hint. The orchestrator adds the English rows to `web/src/i18n/en.js`; do not edit en.js.

## Test
- relay tests:
  - `provider:"baseten"` with `BASETEN_API_KEY` set → handler called.
  - Without the key → `400 provider`.
  - `provider:"x"` → `400 provider`.
  - The 151st baseten call in a day → `429 open_limit`.
  - Same IP, session "a" on meta then baseten → both allowed; session "b" on baseten → `429 server_key_used`.
  - `/api/model/status` never contains the key string and reports `baseten.hasServerKey` from env.
- `web/tests/` (chat request builder): when the stored choice is `baseten`, the body carries `provider:"baseten"`. On a mocked `open_limit` the retry carries `provider:"meta"` and the notice line renders.
- Run only those files, `| tail -15`. Stop after 2 failed fix attempts and print the failure.

## Do not touch
`web/src/places/*`, `web/src/ui/candidate-card.jsx`, `web/src/render/*`, `web/src/i18n/*`.

## Final message
Changed files, one line each. Nothing else.

## Orchestrator after merge (not for Muse)
- Set `BASETEN_API_KEY` on the relay (Vercel production env) together with the Meta key restore; Baseten credit ($100) covers 150 calls/day until Nov 8.
- Record one replay with Muse Spark Open (Meta HQ, same two homes as the Spark 1.3 replay). Add it to the landing as a third "Try it now" button: **"Same month on open weights"**.
- README "Built with Meta" table: the Spark Open row becomes "Live in the product (header switch) + offline comparison".
