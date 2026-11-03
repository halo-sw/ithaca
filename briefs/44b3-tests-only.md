# 44b3 — TESTS ONLY, write before exploring

Product implementation for 44b/44b2 is DONE. Both previous runs exhausted their step budgets reading and patching without writing tests. This run MUST create tests. AGENTS.md: Muse authors code/tests. No git/full suite/build/subagents. No more product edits unless a NEW test proves a bug; at most two fixes. NO broad grep/find searches, NO checking package/setup/docs. Limit source reads to ONE batched read of the files/ranges below, then write all tests in one batch. Do not re-read anything. Keep final output short.

Read exactly once:
- web/src/judge/household.js all (~170lines)
- web/src/chat/engine.js:321-385,455-567 (missingRouteHomes + worker)
- web/src/consult/server.js:30-130 and the task decision branch (locate with ONE rg then sed 35 lines)
- web/tests/engine-fixture.js all (~165lines)
- web/tests/judge-run.test.js:1-96
- web/tests/relay-23a.test.js:15-37 (mockRes)
No need to read old briefs. These tests can be compact and combined into THREE new files.

## 1. web/tests/household-live-44b.test.js
Imports node:test/assert, tinyArea/tinyScenario/tinyRegion, runHouseholdLoop, simulate, canon.
- Run tiny engine with injected judge, all branches default except choose the NON-default valid station_route option at least once. Valid entry: chosen_key, chosen_by:'model', reason_ko:'테스트 이유',reason_en:'Test reason'; weekend entry uses plan:[default_key] (home ->[]). Assert at least one selected alternative, actual commute trip's destination or path differs from rules baseline, all household final branches stamped model and all background branches rule. Replay `simulate(area,scenario,'A',{decisions:run.decisions})` equals canon(run).
- Repeat with tinyRegion and destination_station='직장역' on adult work. Replay with same region equals result; no unjudged shells. This exercises region drift, not a source-string assertion.
- judge throw rejects; no entry rejects. Explicit rule_fallback retains source and counts.
- Test missingRouteHomes: finite per-home zero valid, missing B flagged, child/senior/work:none/place ignored. No fake zero.

## 2. web/tests/worker-live-44b.test.js
Imports createWorkerRunner. A tiny FakeWorker stores postMessage calls and uses queueMicrotask/onmessage to send first decisionRequest, then second after receiving answer, then final runs. Implement yourself, no fixture search.
- Two decisions handled in order; promise resolves only after final `{ok:true,runs}`; worker terminated; posted scenario + answers contain no key string (callback closes over test key, returns only entry).
- Callback error -> worker decisionError -> ok:false -> rejects and terminates.
- Timeout with no messages rejects. Use 30ms timeout, injected progress at intervals <30ms for ~70ms then completion to prove inactivity resets; do not use 1ms races.
- Late answer after timeout cannot post or resolve a second time.
- Old no-options runner result still accepted, progress not completion.

## 3. web/tests/decision-api-44b.test.js
Imports createConsultHandler, createRelay. Implement minimal res {statusCode:200,headers:{},setHeader,end} that captures body synchronously; req has method:'POST', headers, body object (readBody supports parked object).
Context: member adult; agentLabel You,date2026-11-02,weekdayMon,memory[],tripsToday[], shell id h1:d0:600:shop_choice:00,agent h1,day0,minute600,kind shop_choice,default_key s0,options s0(3.2min,250m),s1(5.1min,400m).
Fake provider fetch returns {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify({chosen_key:'s1',reason_ko:'걷고 싶어서',reason_en:'A longer walk fits this routine'})}}],usage:{prompt_tokens:100,completion_tokens:20}})}. Capture opts.headers.Authorization inside test. Handler options: env:{META_API_KEY:'server-test-key'}, fetchImpl stub, readText:()=>{throw Error('should not load files for decision')}. Request BYOK header x-model-key:'own-test-key'. Assert own Authorization used and response never includes either key.
- invalid choice becomes explicit guarded fallback.
- malformed shell ->400 and zero fetch calls.
- provider HTTP401 containing fake key ->503 generic outage, no echoed key; no ok:true fallback. HTTP401 avoids retry delays.
Relay fixture: createRelay({env:{META_API_KEY:'fake'},now:()=>clock,consultFactory:()=>async(req,res)=>res.end(JSON.stringify({ok:true}))}); req url /api/consult, origin https://halo-sw.github.io, x-forwarded-for a unique IP, x-ithaca-session session id (verify exact header constant by importing SESSION_HEADER, not guessing), body{task:'decision',provider:'meta'}.
- 21 decision calls same session pass; 21 normal chat calls fresh same relay same session hits original20/10m quota (decisions don't spend chat credits).
- 121st decision in10m blocked; after advancingclock601000 more pass (day cap retained). Different session sameIP rejected server_key_used.
- Judge code env JUDGE_CODES string>=12chars, x-ithaca-judge header; two sessions sameIP accepted; 1501st decision day blocked with clock advanced between groups enough to avoid window (judge skipsIPwindow). Global decision budget can be verified with additional judge traffic/clients if useful; don't write enormous needless cases.
- malformed JSON body ->400.

Run ONLY: `node --test web/tests/household-live-44b.test.js web/tests/worker-live-44b.test.js web/tests/decision-api-44b.test.js web/tests/judge-run.test.js web/tests/chat-engine-12b.test.js web/tests/relay-23a.test.js web/tests/byok-13.test.js 2>&1 | tail -35`.
Fix only genuine failures max2 rounds, then STOP. Test failure output is better than spending all steps on more exploration.
