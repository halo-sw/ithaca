# 49a — Resume the same real month after a short server rate limit
User authorized all product work through Muse Code. One narrow part only. Do not explore, git, full suite/build, or subagents. Implement in <=22 steps. All state/limits remain honest.

Problem: normal 2-person month can issue >120 decisions, exceeding public 120/10min limit. postDecision throws429 and loses run. Respect existing limit, session and provider; do NOT change backend budgets or IDs, do NOT fallback to rules.

Implement:
1. A small pure decision retry helper module if useful, with injectable sleep/fetch for tests. Only HTTP429 with JSON error exactly rate_limited and finite retryAfterSec (or valid Retry-After seconds) from 1..600 may wait then retry same request. At most2 retries and <=1200s total advertised wait. All other errors (server_key_used/open_limit/auth/network/timeout/malformed) reject. Wait must be abortable, heartbeat about1s with remaining seconds. Same ordinary session/provider/headers/body throughout; no logs of secrets. Signal abort must cancel pending fetch/sleep and never retry. Preserve existing request timeout per attempt.
2. postDecision accepts optional signal,onWait and uses helper. Return payload shape unchanged. Rate limit messages useful; abort differs from timeout.
3. createWorkerRunner supplies decide(context,{signal,onWait}). Own AbortController, abort on settle/fail. onWait must rearm worker inactivity timeout and relay progress {decisionWait:{remainingSec}} while retaining last known progress (done,label,decision). No fake choice progress. Emit wait-clear when resumed. Ignore all callbacks aftersettled. Existing one-arg decide callbacks remain compatible.
4. chat.jsx connection passes options into postDecision. Keep current choice count/reason; add plainly translated progress line 'Muse request limit · resuming this month in N s' / corresponding Korean when waiting. No new CSS or wrapper; existing Astryx Text. Only named sections below.
5. Add focused tests for actual 429→wait→same payload success, refuses gates, bounded/malformed delays, abort cancels and no late workerpost; worker heartbeat survives timeout. Use fake timing/injected sleep so suite fast. Run only your newtests + worker-live-44b tests. Stop after2failedfixes.

Allowed read: named excerpts below, web/src/paths.js only if needed test module import, web/tests/worker-live-44b.test.js lines1–85 for fakeworker, web/tests/decision-api-44b.test.js lines1–45 for context only. Relevant existing repo rules already apply.

## web/src/ui/consult-client.js:1–61
```
1: // Consult browser client: thin fetch wrappers (no React, no keys).
2: //
3: // The chat's free questions post to /api/consult (dev server or, on the
4: // public site, the relay, which keeps the keys); the fixed flow
5: // (profile → candidates → simulation) runs keyless in the browser, and
6: // ?ask=… replays recorded replies. Nothing here imports server modules
7: // or provider code, so no key material can enter the bundle.
8: //
9: // 23b: on the public site the calls go to the relay, which keeps the
10: // keys. Without a live API (no dev server, no relay) the model calls
11: // stay off and the rule-based flow keeps working.
12: 
13: import { assetUrl, LIVE_API, apiUrl } from "../paths.js";
14: import { SESSION_HEADER, getChatSessionId } from "../chat/session-id.js";
15: import { judgeHeaders } from "../chat/judge-code.js";
16: 
17: // 41e: one server-key chat session per IP — every /api/consult
18: // request carries the tab's session id (BYOK requests too; the
19: // relay enforces the rule on the server key only).
20: function sessionHeaders() {
21:   let headers = {};
22:   try {
23:     const id = getChatSessionId();
24:     if (id) headers = { [SESSION_HEADER]: id };
25:   } catch {
26:     /* no storage — the relay treats it as a new session */
27:   }
28:   try {
29:     return { ...headers, ...judgeHeaders() };
30:   } catch {
31:     return headers;
32:   }
33: }
34: 
35: function markServerKeyUsed(err, payload) {
36:   if (payload && payload.error === "server_key_used") err.code = "server_key_used";
37:   else if (payload && payload.error === "open_limit") err.code = "open_limit";
38:   return err;
39: }
40: 
41: // 41f: a baseten turn that fails for any reason except the spent
42: // server-key session is worth one retry on Muse Spark 1.3. Pure.
43: export function basetenFallbackProvider(provider, err) {
44:   if (provider !== "baseten") return null;
45:   if (err && err.code === "server_key_used") return null;
46:   return "meta";
47: }
48: 
49: // 41g: Spark Open answers slowly (4–5k reasoning tokens) — the diary
50: // and report-check fetches wait longer on baseten than on meta.
51: export const CONSULT_TIMEOUT_MS = { meta: 90000, baseten: 180000 };
52: 
53: export function consultTimeoutMs(provider) {
54:   return provider === "baseten" ? CONSULT_TIMEOUT_MS.baseten : CONSULT_TIMEOUT_MS.meta;
55: }
56: 
57: function timeoutSignal(ms) {
58:   const ctrl = new AbortController();
59:   const timer = setTimeout(() => ctrl.abort(), ms);
60:   return { signal: ctrl.signal, done: () => clearTimeout(timer) };
61: }
```

## web/src/ui/consult-client.js:112–171
```
112: // 44b: one guarded household branch decision. The worker asks once
113: // per branch and the main thread answers through here; the server
114: // judges exactly this context and returns the saved entry (model or
115: // explicit rule_fallback). Failures — rate limits, auth, network,
116: // timeouts — reject: they are never converted into a silent rule
117: // success. The whole JSON body is read inside the timeout lifetime.
118: export async function postDecision({ provider, context, byoKey = "" }) {
119:   if (!LIVE_API) {
120:     const err = new Error("상담 서버에 연결되어 있지 않아요");
121:     err.code = "offline";
122:     throw err;
123:   }
124:   const headers = { "Content-Type": "application/json", ...sessionHeaders() };
125:   if (byoKey) headers["x-model-key"] = byoKey;
126:   const started = (typeof performance !== "undefined" ? performance.now() : 0);
127:   const wait = timeoutSignal(consultTimeoutMs(provider));
128:   let r;
129:   let payload = null;
130:   try {
131:     r = await fetch(apiUrl("/api/consult"), {
132:       method: "POST",
133:       headers,
134:       body: JSON.stringify({ task: "decision", provider, context }),
135:       signal: wait.signal,
136:     });
137:     payload = await r.json();
138:   } catch (err) {
139:     if (err && err.name === "AbortError") {
140:       const timeout = new Error("Muse의 선택이 늦어져서 중단했어요");
141:       timeout.code = "timeout";
142:       timeout.httpStatus = 408;
143:       throw timeout;
144:     }
145:     throw err;
146:   } finally {
147:     wait.done();
148:   }
149:   const latencyMs = (typeof performance !== "undefined" ? performance.now() : 0) - started;
150:   if (!r.ok || !payload || payload.ok !== true) {
151:     if (r.status === 429) {
152:       const err = new Error("잠시 쉬었다가 다시 물어봐 주세요 (요청이 많아요)");
153:       err.httpStatus = 429;
154:       throw markServerKeyUsed(err, payload);
155:     }
156:     if (r.status === 401 || r.status === 403) {
157:       const err = new Error((payload && payload.error) || `상담 서버 인증 오류 (HTTP ${r.status})`);
158:       err.httpStatus = r.status;
159:       throw err;
160:     }
161:     const err = new Error((payload && payload.error) || `상담 서버 오류 (HTTP ${r.status})`);
162:     err.httpStatus = r.status;
163:     throw err;
164:   }
165:   payload.latencyMs = Math.round(latencyMs);
166:   return payload;
167: }
168: 
169: // 47e: household life-plan generation. Mirrors postDecision (same
170: // session/BYOK headers, same providers, no silent switch) but posts
171: // task:'life_plan'. Only bounded user history is sent — never the
```

## web/src/chat/engine.js:466–553
```
466: export function createWorkerRunner(makeWorkerOrUrl,
467:     { timeoutMs = 180000, decisionMode = null, decide = null } = {}) {
468:   const makeWorker = typeof makeWorkerOrUrl === "function"
469:     ? makeWorkerOrUrl
470:     : () => new Worker(makeWorkerOrUrl, { type: "module" });
471:   if (typeof makeWorkerOrUrl !== "function" && typeof Worker === "undefined") {
472:     throw new Error("sim worker needs a browser Worker");
473:   }
474:   return (scenarioInline, labels, onProgress = () => {}) => new Promise((resolve, reject) => {
475:     let worker;
476:     try {
477:       worker = makeWorker();
478:     } catch (err) {
479:       reject(err);
480:       return;
481:     }
482:     let settled = false;
483:     let timer = null;
484:     const fail = (err) => {
485:       if (settled) return;
486:       settled = true;
487:       if (timer) clearTimeout(timer);
488:       try {
489:         worker.terminate();
490:       } catch {
491:         /* already gone */
492:       }
493:       reject(err);
494:     };
495:     const arm = () => {
496:       if (timer) clearTimeout(timer);
497:       timer = setTimeout(() => fail(new Error("sim worker timed out")), timeoutMs);
498:     };
499:     arm();
500:     worker.onmessage = (e) => {
501:       const d = e.data || {};
502:       if (d.decisionRequest) {
503:         arm();
504:         const { requestId, context } = d.decisionRequest || {};
505:         Promise.resolve()
506:           .then(() => {
507:             if (typeof decide !== "function") throw new Error("no decision callback");
508:             return decide(context);
509:           })
510:           .then(
511:             (entry) => {
512:               if (settled) return; // late answer to a dead run
513:               arm();
514:               worker.postMessage({ decisionAnswer: { requestId, entry } });
515:             },
516:             (err) => {
517:               if (settled) return;
518:               try {
519:                 worker.postMessage({ decisionError: {
520:                   requestId, error: String((err && err.message) || err),
521:                 } });
522:               } catch {
523:                 fail(err instanceof Error ? err : new Error(String(err)));
524:               }
525:               // The worker stops on the error and reports {ok:false};
526:               // that post completes the rejection below.
527:             },
528:           );
529:         return; // a decision exchange is never completion
530:       }
531:       if (d.progress) {
532:         arm();
533:         onProgress(d.progress);
534:         return;
535:       }
536:       if (settled) return;
537:       settled = true;
538:       if (timer) clearTimeout(timer);
539:       try {
540:         worker.terminate();
541:       } catch {
542:         /* already gone */
543:       }
544:       if (d.ok) resolve(d.runs);
545:       else reject(new Error(d.error || "sim worker failed"));
546:     };
547:     worker.onerror = (err) => {
548:       fail(err);
549:     };
550:     worker.postMessage({ scenarioInline, labels,
551:       ...(decisionMode ? { decisionMode } : {}) });
552:   });
553: }
```

## web/src/ui/chat.jsx:1297–1325
```
1297: export function SimulationCard({ data, example, onRetry, onScene, onReportRetry, onDiaryRetry, canRetryDiary }) {
1298:   if (!data) return null;
1299:   if (data.status === "running") {
1300:     const p = data.progress || { done: 0, total: 1, label: "" };
1301:     return (
1302:       <Card padding={4}>
1303:         <VStack gap={3}>
1304:           <HStack gap={1} vAlign="center">
1305:             <Heading level={4}>30일 살아 보는 중</Heading>
1306:             {example && <Text type="supporting">{EXAMPLE_PROFILE_LABEL}</Text>}
1307:           </HStack>
1308:           <ProgressBar label={`살아 보기 진행 중 (${p.done}/${p.total})`}
1309:             value={p.total > 0 ? Math.round((p.done / p.total) * 100) : 0} max={100} />
1310:           <Text type="supporting" hasTabularNumbers>
1311:             {p.label ? `${p.label} 실행 중… (${p.done}/${p.total})` : "준비 중…"}
1312:           </Text>
1313:           {p.muse && (
1314:             <Text type="supporting" hasTabularNumbers>
1315:               {museProgressLine(p.muse)}
1316:             </Text>
1317:           )}
1318:         </VStack>
1319:       </Card>
1320:     );
1321:   }
1322:   if (data.status === "error") {
1323:     return (
1324:       <Card padding={4}>
1325:         <VStack gap={3}>
```

## web/src/ui/chat.jsx:4267–4285
```
4267:       let museProgress = null;
4268:       const runner = createWorkerRunner(() => new Worker(new URL("../sim-worker.js", import.meta.url), { type: "module" }),
4269:         museDecisions
4270:           ? { decisionMode: "muse",
4271:               decide: (context) => postDecision({ provider, context, byoKey: byoKeyForRun(provider) })
4272:                 .then((out) => out.entry) }
4273:           : {});
4274:       const { runs, compare, ms } = await runStep(
4275:         (s, l, onP) => runner(s, l, (pg) => {
4276:           if (pg && pg.decision) museProgress = pg.decision;
4277:           setProgress({ done: pg.done + 1, total: picked.length + 1, label: pg.label,
4278:             ...(museProgress ? { muse: museProgress } : {}) });
4279:         }),
4280:         scenValue, labels);
4281:       // 47l: the per-home summary is computed exactly once here, from
4282:       // the actual runs + the confirmed plan — before anything is saved
4283:       // or rendered, so no summary ever precedes its runs.
4284:       const lifeSummaries = extras
4285:         ? Object.fromEntries(labels.map((l) => [l, summarizePlanRun(runs[l], extras.plan)]))
```

## relay/handler.js:271–287
```
271:   }
272: 
273:   function sendOriginError(res) {
274:     res.statusCode = 403;
275:     res.setHeader("Content-Type", "application/json");
276:     res.end(JSON.stringify({ ok: false, error: "origin" }));
277:   }
278: 
279:   function sendLimited(res, waitSec, origin) {
280:     res.statusCode = 429;
281:     res.setHeader("Content-Type", "application/json");
282:     res.setHeader("Retry-After", String(waitSec));
283:     corsHeaders(res, origin);
284:     res.end(JSON.stringify({ ok: false, error: "rate_limited", retryAfterSec: waitSec }));
285:   }
286: 
287:   return async (req, res) => {
```
