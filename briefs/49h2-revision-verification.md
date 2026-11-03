# 49h2: Verify the actual revision wiring, not a copied driver
Read AGENTS. One tiny follow-up only. No exploration, no build/full suite/git.

Your web/tests/plan-revision-49h.test.js currently driveRevisionSend mirrors the implementation and never executes send() in chat.jsx. Replace that test driver with a harness executing the REAL source async send function (extract between `  async function send(text) {` and `  function chipAction(chip) {`, vm context stubbing dependencies; no JSX in this function). Exercise actual armed branch and call requestPlanFlow stub, assert fresh user message present in stateRef and forcePlan true/current picks/provider, no askAgent/worker call; second ordinary send calls askAgent. Blocked busy, plan busy and replay sends leave intent and messages untouched. Keep helper id dedup test if useful. Do not write a copied send equivalent in tests.

Small product correction: in the new revision branch only, `if (picked.length < 2 || !st.profile) return;` silently drops the reply. Instead append a localized normal sentence asking to choose 2 homes/complete profile, then return. No other behavior change. Leave runGate/readiness guards as existing behavior; no wider refactor.

Read only web/tests/plan-revision-49h.test.js, web/src/chat/routine-revision.js, and web/src/ui/chat.jsx send range 4951–5085. Write once, run only new test + plan-flow-47g. Max2 fixes, then stop.
