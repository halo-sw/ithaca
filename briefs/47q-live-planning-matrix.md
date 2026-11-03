# 47q — real provider planning checks for varied illustrative households

Author only `web/scripts/live-plan-matrix.mjs` and optional `web/scripts/plan-examples.mjs`. Muse Code only. No product changes, browser launch, live API calls, git, or full test suite. Budget 20 steps. Orchestrator will run the script after deploying the reviewed backend. The user explicitly authorized assumed scenarios and the existing public model connection. All examples are hypothetical; no personal family claims.

Read `scenarios/demo-two-homes.json` (base geography and explicitly assumed transit), `src/life/plan.js` exports and input adapter 180–280, and `src/ui/consult-client.js` postLifePlan only. Do not read keys, process environments, or browser profiles.

CLI takes output directory and optionally selected case ids. API base from ITHACA_API_BASE, default https://ithaca-relay.vercel.app. Use a single ordinary client session id across all requests (create a random id once, save in a task-specific file in output directory and reuse on reruns). Header is x-ithaca-session, provider meta, task life_plan, lang en. No API key or judge code, no bypass. Stop clearly on server_key_used / 429 / 401 / 403; do not rotate sessions, retry under another identity, or alter limits. Max one request per case, sequential. A 90 second timeout is fine; no retry loops. Never print headers/session id. Save only generated plan, synthetic input and compact status/latency.

Construct production-shaped profile.members={value:[...],source:'customer'} and scenario.household.members with stable m1/m2/... ids. Start with base example homes/start_date/days/seed and work fields; source transit estimates stay labelled assumptions. Clear baseline clinic/vet/cafe/dog frequencies unless explicitly given, and make all unknown/unsupported requirements visible. Do not use old persona JSON files that infer stereotyped schedules.

Seven cases, each one explicit user message carrying all stated conditions and preferences:
1. solo: one adult, known Pangyo office five weekdays, supermarket once weekly, quiet mornings.
2. couple: two adults with the explicitly shared known office; m1 Mon/Wed/Fri, m2 Tue/Thu; different preferences (quiet mornings vs evening walks). Use workdays as office-travel days; do not claim unsupported exact remote working hours.
3. family4: two adults + children age9 and15, two separate labels, weekday school routines but actual schools unconfirmed. The plan must expose unresolved school/enrollment, not claim assignment. A nearby typed-school proposal is acceptable only if clearly a proposal; no certainty.
4. remote: one adult explicitly no commute, no café work, weekly groceries.
5. working_senior: one senior explicitly still works Mon/Wed/Fri at the known office; no clinic appointments. Never infer retirement or medical needs.
6. dog_owner: one adult with dog, explicitly daily morning walks, no scheduled vet visits.
7. combined: hybrid adult + working senior + child + dog; explicit responsible dog walker; school unknown; asks whether pickup coordination can be checked. All members must survive and coordination must be identified as unmodeled rather than fabricated.

For each response verify with actual buildLifePlanInput + normalized-envelope/schema validation (use requestPlanReview helper if convenient; do not call validateLifePlan on normalized fields directly). Save actual model output even if it fails an expectation. Assertions: exact member coverage, provider source, bounded valid plan, case-specific workday/preference preservation in effective plan, remote no-commute, no unasked clinic/cafe/vet routines, unresolved schooling visible, unsupported pickup visible. Do not automatically confirm plans with questions. Distinguish schema pass, behavior pass and review needed. A legitimate question is not a provider failure. No claiming full 30-day execution: this script checks planning only.

Output summary JSON with live_model:true, illustrative_households:true, actual response status per case, expected vs actual notes, no invented success. If one case fails a semantic assertion, continue other cases unless server access/rate gate says stop. Exit nonzero for actual failures. `--help` may print usage; `node --check` only here, then stop.
