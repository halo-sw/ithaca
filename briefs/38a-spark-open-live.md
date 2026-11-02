# Stage 38a — Muse Spark Open runs live in the product (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Stop when this part is done.

## Why
Muse Spark Open (`meta-models/muse-spark-open-1026` on Baseten) is wired in `web/src/judge/providers.js` (`PROVIDERS.baseten`). Today it only runs offline in the judge CLI comparison (`scenarios/decisions/compare-1029/`). Visitors can never reach it: `relay/handler.js` (≈ lines 290–311) answers `400 provider` to any `/api/consult` body whose `provider` is not `"meta"` unless the BYOK header is set. The product should let anyone run the same consult on the open-weights model, with a safe budget.

## Change
1. `relay/handler.js` `/api/consult`:
   - Allow `provider === "baseten"` without BYOK **when the server env has `BASETEN_API_KEY`**. Keep `400 provider` for any other value.
   - Add a separate global day bucket for baseten: `checkGlobal(consultGlobalBaseten, t, DAY_MS, 150)`. Over the cap → `429` with `{ ok:false, error:"open_limit" }`.
   - `GET /api/consult/status` (new, no body): `{ ok:true, providers: { meta: true, baseten: <bool key present> } }`. It must never return a key.
2. `web/src/consult/agent.js`: no change in logic. Confirm that `provider` from the request body reaches `providerConfig(provider)` and `completeWithTools`. If Baseten rejects `reasoning_effort` or `json_schema`, the existing omission path in `providers.js` already handles it. Add a test that proves it.
3. UI (`web/src/ui/powered-by-muse.jsx` and the chat request builder in `web/src/ui/chat.jsx`):
   - Turn the header model label ("● Muse Spark 1.3") into a two-item `SegmentedControl`: **Muse Spark 1.3** | **Muse Spark Open · open weights**. Show the second item only when `/api/consult/status` says `baseten: true`.
   - The choice is sent as `provider` on every `/api/consult` call for the rest of the session. Keep it in `sessionStorage`, wrapped in try/catch.
   - Every assistant reply shows a small tag under the message with the model that answered (`providerLabel(provider)`).
   - On `open_limit` or any baseten error: switch back to Muse Spark 1.3 for that turn and show one line: "Muse Spark Open is busy, so this answer used Muse Spark 1.3."
4. Copy (ko + en tables): "오픈 웨이트 모델(Muse Spark Open)로 같은 상담을 돌려 볼 수 있어요" / "Run the same consult on the open-weights model (Muse Spark Open)". Add the strings to `web/src/i18n/en.js`.

## Test
- `relay` tests:
  - `provider:"baseten"` with `BASETEN_API_KEY` set → handler called.
  - Without the key → `400 provider`.
  - `provider:"x"` → `400 provider`.
  - The 151st baseten call in a day → `429 open_limit`.
  - `/api/consult/status` never contains the key string.
- `web/tests/` (chat request builder): when the stored choice is `baseten`, the body carries `provider:"baseten"`. On a mocked `open_limit` the retry carries `provider:"meta"` and the notice line renders.
- Run only those files, `| tail -15`. Stop after 2 failed fix attempts and print the failure.

## Do not touch
`web/src/places/*`, `web/src/ui/candidate-card.jsx` (37a/37b), `web/src/render/*`.

## Final message
Changed files, one line each. Nothing else.

## Orchestrator after merge (not for Muse)
- Set `BASETEN_API_KEY` on the relay (Vercel env) and check the Baseten credit balance covers 150 calls/day until Nov 8.
- Record one replay with Muse Spark Open (Meta HQ, same two homes as the Spark 1.3 replay). Add it to the landing as a third "Try it now" button: **"Same month on open weights"**.
- README "Built with Meta" table: the Spark Open row becomes "Live in the product (header switch) + offline comparison".
