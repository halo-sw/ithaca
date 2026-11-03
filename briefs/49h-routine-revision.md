# 49h: Routine revision goes directly back to plan review
Read AGENTS. Product code/tests only, no git/full suite/build/subagents. This is one small UI flow correction.

Observed: after clicking `Adjust my routine`, the user clarifies errands/remote days. send() routes that answer through generic askAgent, which attempts update_scenario and re-searches buildings, fails on a valid saved candidate, and never regenerates the reviewed plan. User has to click Live 30 days again.

Fix: clicking the review card's Adjust button arms a one-turn routine-revision flow. The next nonempty valid send appends the exact user quote, clears composer, consumes this intent exactly once, and directly requests a NEW plan for CURRENT picks/provider/profile + updated message history. It must not call generic askAgent/structuredFlow, change picks, mutate profile/scenario, or execute the worker. The new card still needs explicit confirmation. Preserve single-flight/stale-response safeguards. Busy/replay blocked sends must not consume the intent or append. The stateRef messages used for buildReviewInput must already contain this user message (React state is asynchronous). Do not duplicate append.

When armed but current conditions cannot plan, display normal existing gate/error and consume once; never silently fall back to a generic turn. Ensure ordinary sends still route normally and later sends do not inherit the intent. Keep new state/helper small. Tests should exercise revision transaction using actual helper/callback wiring, fresh quote/signature, once-only consumption, blocked send preservation, no generic/worker invocation and normal next send. Only run the focused new test and existing plan-flow-47g/plan-api-card-47e tests.

Only touch web/src/ui/chat.jsx, a small pure flow helper if useful, and one regression test. No design/layout changes. Exact relevant snippets follow.

## chat.jsx:3295-3350
```js
3295:   }, [candidatesData]);
3296:   const idRef = useRef(0);
3297:   const busyRef = useRef(false);
3298:   // 47g: the provider in effect, re-read on every render so late model
3299:   // responses are dropped when it changed mid-flight.
3300:   const providerRef = useRef(provider);
3301:   providerRef.current = provider;
3302:   const composerWrapRef = useRef(null);
3303:   // 47l: plan/run single-flight guard, independent of the chat
3304:   // composer's busy flag so an internal agent handoff is never dropped.
3305:   const planGuardRef = useRef(null);
3306:   if (!planGuardRef.current) planGuardRef.current = createPlanGuard();
3307:   // 47l: the one staged confirmed execution payload (consumed exactly
3308:   // once by the run body; never a reused global).
3309:   const confirmedTxnRef = useRef(null);
3310:   if (!confirmedTxnRef.current) confirmedTxnRef.current = createConfirmedTransaction();
3311:   const replyCountRef = useRef(0);
3312:   const profileRef = useRef(null);
3313:   useEffect(() => { profileRef.current = profile; }, [profile]);
3314:   const dataRef = useRef(null); // {index, network, schedule, manifest, regionsKey}
3315:   // 29j3: slim report inputs per sim message id (for 다시 검증하기).
3316:   const reportInputsRef = useRef({});
3317:   // 42b: diary inputs per sim message id (for 일기 다시 쓰기).
3318:   const diaryInputsRef = useRef({});
3319:   const stateRef = useRef({ messages, toolRows, profile, candidatesData, picks, exampleId, scenario });
3320:   stateRef.current = { messages, toolRows, profile, candidatesData, picks, exampleId, scenario,
3321:     intake, household, overrides, usageLog };
3322:   const viewChip = useSyncExternalStore(store.subscribe,
3323:     () => selectState(store.getState()).viewChip,
3324:     () => selectState(store.getState()).viewChip);
3325: 
3326:   const nextId = () => {
3327:     idRef.current += 1;
3328:     return `m${idRef.current}`;
3329:   };
3330: 
3331:   // Append, or replace the latest card of a state kind (profile /
3332:   // candidates / simulation always show the latest state).
3333:   const pushMsg = (msg) => {
3334:     const id = msg.id || nextId();
3335:     if (countsAsVisibleReply(msg)) replyCountRef.current += 1;
3336:     // 42b: assistant text without an explicit fromModel did not come
3337:     // from the model (rule flow, recorded replay keeps its own flag).
3338:     const stamped = (msg.role === "assistant" && msg.fromModel === undefined && !msg.recorded)
3339:       ? { ...msg, fromModel: false } : msg;
3340:     setMessages((prev) => nextChatMessages(prev, stamped, id));
3341:     return id;
3342:   };
3343: 
3344:   const addToolRow = (row) => {
3345:     const id = row.id || nextId();
3346:     setToolRows((prev) => ({ ...prev, [id]: { ...row, id } }));
3347:     return id;
3348:   };
3349: 
3350:   // 30b: keyless servers say so once per session (never per turn).
```

## chat.jsx:3964-3998
```js
3964:   // 47g: live run request without a review — build the bounded input,
3965:   // reuse a fresh review card when one already matches, otherwise post
3966:   // one planner call and store the review. Never the worker.
3967:   async function requestPlanFlow({ ids, picked, providerInUse, byoKeyForRun, forcePlan }) {
3968:     const guard = planGuardRef.current;
3969:     if (!guard.tryAcquire()) return;
3970:     setWorkOpen(true);
3971:     setBusy(true);
3972:     try {
3973:       const st0 = stateRef.current;
3974:       let scenValue;
3975:       try {
3976:         ({ scenValue } = await loadBaseForPlan(st0, picked));
3977:       } catch (err) {
3978:         pushMsg({ role: "assistant", kind: "life_plan",
3979:           data: { status: "error", plan: null, input: null, pickedIds: [...ids],
3980:             provider: providerInUse, snapshot: null,
3981:             error: String((err && err.message) || err) },
3982:           example: st0.exampleId });
3983:         return;
3984:       }
3985:       const input = buildReviewInput({ scenario: scenValue, profile: st0.profile,
3986:         messages: st0.messages, lang: LANG });
3987:       const snapshot = reviewSnapshot({ profileText: profileTextOf(st0.profile),
3988:         pickedIds: ids, provider: providerInUse, messages: st0.messages });
3989:       // 47l2: re-check CURRENT conditions after the awaited preparation
3990:       // and BEFORE any post — a moved provider/picks/profile/user
3991:       // history goes stale with a retry, never an API call.
3992:       {
3993:         const cur0 = stateRef.current;
3994:         const curInput0 = buildReviewInput({ scenario: scenValue, profile: cur0.profile,
3995:           messages: cur0.messages, lang: LANG });
3996:         const curSnap0 = reviewSnapshot({ profileText: profileTextOf(cur0.profile),
3997:           pickedIds: cur0.picks, provider: providerRef.current, messages: cur0.messages });
3998:         if (providerRef.current !== providerInUse
```

## chat.jsx:4167-4228
```js
4167:   // forces a new planner call for the current inputs; revise fills
4168:   // the existing composer with a localized starter and focuses it.
4169:   function handlePlanConfirm(messageId) {
4170:     const m = (stateRef.current.messages || []).find((x) => x && x.id === messageId);
4171:     if (!m || m.kind !== "life_plan" || !m.data) return;
4172:     // 47l: the run resolves CURRENT picks inside — never stored ids.
4173:     void handleRun(null, messageId);
4174:   }
4175: 
4176:   function handlePlanRetry() {
4177:     void handleRun(null, null, true);
4178:   }
4179: 
4180:   function handlePlanRevise() {
4181:     setComposer(LANG === "en" ? "Adjust my routine: " : "생활 패턴 조정: ");
4182:     soon(() => {
4183:       try {
4184:         const root = composerWrapRef.current;
4185:         const el = root && root.querySelector
4186:           ? root.querySelector("textarea, [contenteditable='true'], input") : null;
4187:         if (el && typeof el.focus === "function") el.focus();
4188:       } catch {
4189:         // The starter text is set either way.
4190:       }
4191:     });
4192:   }
4193: 
4194:   async function handleRun(idsOverride = null, reviewId = null, forcePlan = false, confirmedDirect = null) {
4195:     const guard = planGuardRef.current;
4196:     // 47l: single-flight on the plan/run guard — never the chat composer
4197:     // flag, so an agent tool run action inside a busy send() still runs.
4198:     // 47l2: the confirmed handoff released the guard synchronously
4199:     // before calling here, so this body ALWAYS acquires it — a second
4200:     // confirm/run overlapping this one is rejected below. The explicit
4201:     // payload only selects the applied scenario, never a guard bypass.
4202:     const hasConfirmedPayload = !!(confirmedDirect && confirmedDirect.applied && confirmedDirect.plan);
4203:     if (guard.busy) return;
4204:     setWorkOpen(true);
4205:     const st = stateRef.current;
4206:     const reviewMsg = reviewId
4207:       ? (st.messages || []).find((m) => m && m.id === reviewId && m.kind === "life_plan")
4208:       : null;
4209:     if (reviewId && (!reviewMsg || !reviewMsg.data)) return;
4210:     // 47l: always CURRENT picks — an old AB review never runs after the
4211:     // user changed to AC.
4212:     const ids = (confirmedDirect && Array.isArray(confirmedDirect.ids) && confirmedDirect.ids.length > 0)
4213:       ? confirmedDirect.ids
4214:       : (reviewMsg
4215:         ? [...(st.picks || [])]
4216:         : (Array.isArray(idsOverride) ? idsOverride : st.picks));
4217:     const picked = ((st.candidatesData && st.candidatesData.result.candidates) || [])
4218:       .filter((c) => ids.includes(c.id));
4219:     if (picked.length < 2 || !st.profile) return;
4220:     // 21a: no run without a commute — unless the customer chose none.
4221:     const gate = runGate(st.profile);
4222:     if (!gate.ok) {
4223:       pushMsg({ role: "assistant", kind: "text",
4224:         content: "회사 위치를 먼저 알려 주세요. 회사 근처 역이나 동네를 말씀해 주시면 그 길로 30일 살아 보기를 돌려요. 출근을 안 하시면 “출근 안 해요”라고 말씀해 주세요." });
4225:       return;
4226:     }
4227:     const noCommute = gate.noCommute === true;
4228:     const blocked = picked.filter((c) => readinessNote(c));
```

## chat.jsx:4944-5020
```js
4944:   async function send(text) {
4945:     const content = String(text || "").trim();
4946:     if (!content || busyRef.current) return;
4947:     // 47l: a plan/run transaction in flight single-flights on its own
4948:     // guard — the composer waits instead of interleaving with it.
4949:     if (planGuardRef.current && planGuardRef.current.busy) return;
4950:     // 29a6: replay mode never calls the consult client — the composer is read-only while replaying.
4951:     if (replayId || replaying) return;
4952:     busyRef.current = true;
4953:     setBusy(true);
4954:     setError("");
4955:     setNoAnswerSaved(false);
4956:     setChipsNearBottom(true);
4957:     pushMsg({ role: "user", kind: "text", content });
4958:     setComposer("");
4959:     // 27j: the rules path always answers — count replies added after this point.
4960:     const repliesBefore = replyCountRef.current;
4961:     try {
4962:       // 30b: keyless servers say so once, then the rule flow answers.
4963:       if (museLive === false) noticeKeylessOnce();
4964:       if (content === "매물 글 붙여 넣기") {
4965:         pushMsg({ role: "assistant", kind: "listing", data: {} });
4966:       } else if (routeTurn({ live: shouldCallMuse({ museLive }), museFails }) === "agent") {
4967:         await askAgent(content);
4968:       } else if (/check_listing으로 확인해줘|add_listing_c로 C에 추가해줘|C로 추가해줘/.test(content)) {
4969:         pushMsg({ role: "assistant", kind: "text",
4970:           content: "매물 확인은 개발 서버 + 키에서 실거래와 대조해요. 글 읽기는 ’매물 글 붙여 넣기’에서 바로 돼요." });
4971:         pushMsg({ role: "assistant", kind: "listing", data: {} });
4972:       } else if (/전세 점검/.test(content)) {
4973:         const usd = stateRef.current.profile
4974:           && stateRef.current.profile.currency
4975:           && stateRef.current.profile.currency.value === "USD";
4976:         if (usd) {
4977:           pushMsg({ role: "assistant", kind: "text", content: US_NO_JEONSE_SUPPORT });
4978:         } else {
4979:           store.set({ compareOpen: true, compareTab: "jeonse" });
4980:           pushMsg({ role: "assistant", kind: "tab", data: { tab: "jeonse" } });
4981:         }
4982:       } else if (/살 만한/.test(content)) {
4983:         store.set({ compareOpen: true, compareTab: "worthit" });
4984:         pushMsg({ role: "assistant", kind: "tab", data: { tab: "worthit" } });
4985:       } else if (/도움 제도|도움제도|지원 제도|정책 대출|혜택/.test(content)) {
4986:         const usd = stateRef.current.profile
4987:           && stateRef.current.profile.currency
4988:           && stateRef.current.profile.currency.value === "USD";
4989:         if (usd) {
4990:           pushMsg({ role: "assistant", kind: "text", content: US_NO_JEONSE_SUPPORT });
4991:         } else {
4992:           store.set({ compareOpen: true, compareTab: "support" });
4993:           pushMsg({ role: "assistant", kind: "tab", data: { tab: "support" } });
4994:         }
4995:       } else {
4996:         await structuredFlow(content);
4997:       }
4998:       // 27j: the rules path always answers — fallback line when nothing replied.
4999:       // 42f: after a done run the line is the Muse fallback (key invite),
5000:       // otherwise the generic rule line.
5001:       if (routeTurn({ live: shouldCallMuse({ museLive }), museFails }) !== "agent") {
5002:         const answered = answeredSince(replyCountRef.current, repliesBefore);
5003:         if (!answered) {
5004:           pushMsg({ role: "assistant", kind: "text", ruleAnswer: true,
5005:             content: nonMuseNoReplyLine(content,
5006:               { messages: stateRef.current.messages, lang: currentLang() }) });
5007:         }
5008:       }
5009:     } catch (err) {
5010:       setError(String((err && err.message) || err));
5011:     } finally {
5012:       busyRef.current = false;
5013:       setBusy(false);
5014:     }
5015:   }
5016: 
5017:   function chipAction(chip) {
5018:     if (chip === "매물 글 붙여 넣기") {
5019:       pushMsg({ role: "user", kind: "text", content: chip });
5020:       pushMsg({ role: "assistant", kind: "listing", data: {} });
```
