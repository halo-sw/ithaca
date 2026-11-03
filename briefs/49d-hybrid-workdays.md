# 49d — Hybrid work must retain onsite days
Actual public live plan request for couple: m1 commutesMon–Fri; m2 commutesMon/Wed/Fri, worksfromhomeTue/Thu. Muse returned m2 workdaysMon–Fri +home_office:true. Existingengine skippedALLcommutes, reviewsaid0workdays. Do not recordthiswrongplan. Fixunderlyingdate semantics, notfixture/wordinghack.
UserauthorizesMuseonlyproduct. Onenarrowbehavior. <=24steps. No git/fullsuite/build/subagents. Readonlynamedranges/excerpts, smalltargetedrg around newfieldusage okay.

Contract:
- Add optional `home_office_days` uniqueweekdayarray (emptyvalid) to memberplan/scenario/householdagent. If absent, preserve legacybooleanhome_office semantics. If present, it is the exactset of remote workdays; do notlet legacytrueoverridearray. Validatearraycodes/duplicates and subsetofeffectiveworkdays (includingappliedpatch) beforeconfirm; conflicting planrejectinstead ofsilentdrop. Allow explicit[] toclear priorremote routine.
- `workdays` remainsALLworkingdays. `home_office_days` selectswhichofthoseareathome. Forhybridmodel setMon–Friworkdays andTue/Thu remote. `home_office:true` legacymeansallworkdaysremote ONLYwhen newarrayabsent. Prompt explainclearly. Neverchangeplannedshift hours (unsupported).
- Single shared purehelper `isHomeOfficeDay(member,weekday)` in suitableenginecalendar helper (or newwork-schedule.js) usedeverycommutebranch, dogdeparture, cafeeligible, workactivityonhomedays, plansummarycounts. Preserveweekend/nonworkingbehavior. Passarrayfromscenario→agents→decisioncontext input members andeffectiveplan.
- BuildLifePlanInput includesexistingarray assumption onlywhenpresent,signature alreadycovers. Genericapply pathmust preservearray. Plantrace/fieldlabelEN/KO and renderweekdaylist. Calendarpreview shows onsiteworkdays ANDremote days. For2026-11-02+30days expectedm1onsite22, m2onsite13remote9 (verifywithcalendar). Do notclaim22completedtrips fromcalendar.
- Tests: actualtinyenginefixture run hybrid onMon/Tue/Wed: worktrips Mon+Wed, homeofficeactivityTue; othermembersunaffected; legacyfullyremoteunchanged; explicit[] clearslegacytrue; duplicates/outofweekdays/subsetreject; planpreviewmatches actualcalendar; planprovider promptcontains correctcontract. Reuseexistingfixture files below; no expensiveAPIcalls.
- Do notmutate oldrecords or forciblyrepairmodelanswers. Usersreviewnewplan beforeexecute.
Allowed: relevant ranges pasted plus smallnamedtestfixtures: web/tests/routines-*.test.js locate with rg forhome_office, web/tests/life-plan-47*.test.js, web/tests/plan-display-47j.test.js. You may rg newfield/helpertoensureallbrancheschecked. NO fullfiles main/chat.

## web/src/engine/scenario.js:325–362
```
325:   const role = raw.role || "adult";
326:   if (!["adult", "child", "senior"].includes(role)) fail(`${where} has unknown role ${JSON.stringify(role)}`);
327:   if (raw.preferences !== undefined
328:       && (typeof raw.preferences !== "string" || raw.preferences.length > 500)) {
329:     fail(`${where}.preferences wants a short free-text string (≤ 500 chars, no personal or health data)`);
330:   }
331:   if (raw.work_unresolved !== undefined && typeof raw.work_unresolved !== "boolean") {
332:     fail(`${where}.work_unresolved wants a boolean`);
333:   }
334:   if (raw.plan_context !== undefined
335:       && (typeof raw.plan_context !== "string" || raw.plan_context.length > 1200)) {
336:     fail(`${where}.plan_context wants a string of at most 1200 chars`);
337:   }
338:   const out = {
339:     id: typeof raw.id === "string" ? raw.id : `m${index + 1}`,
340:     label: typeof raw.label === "string" ? raw.label : `구성원 ${index + 1}`,
341:     preferences: typeof raw.preferences === "string" ? raw.preferences : "",
342:     role,
343:     workdays: raw.workdays === undefined ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : checkWeekdays(raw.workdays, where),
344:     schooldays: raw.schooldays === undefined ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : checkWeekdays(raw.schooldays, `${where}.schooldays`),
345:     work: parseWork(raw.work, where),
346:     school: parseSchool(raw.school, where),
347:     errands_per_week: parseErrands(raw.errands_per_week, where),
348:     park_walks_per_week: raw.park_walks_per_week === undefined ? 0 : raw.park_walks_per_week,
349:     clinic_visits_per_month: raw.clinic_visits_per_month === undefined ? 0 : raw.clinic_visits_per_month,
350:     cafe_visits_per_week: raw.cafe_visits_per_week === undefined ? 0 : raw.cafe_visits_per_week,
351:     vet_visits_per_month: raw.vet_visits_per_month === undefined ? 0 : raw.vet_visits_per_month,
352:     home_office: raw.home_office === undefined ? false : raw.home_office,
353:     dog_walk_morning: raw.dog_walk_morning === undefined ? false : raw.dog_walk_morning,
354:   };
355:   if (raw.work_unresolved === true) out.work_unresolved = true;
356:   if (typeof raw.plan_context === "string" && raw.plan_context.length > 0) {
357:     out.plan_context = raw.plan_context;
358:   }
359:   return out;
360: }
361: 
362: const LIFE_PLAN_KEYS = ["source", "confirmed", "signature", "days",
```

## web/src/engine/scenario.js:423–446
```
423:   const seed = raw.seed === undefined ? DEFAULT_SEED : raw.seed;
424:   if (!Number.isInteger(seed)) fail("seed wants an int");
425:   for (const [i, m] of members.entries()) {
426:     const pm = parseMember(m, i);
427:     members[i] = pm;
428:     if (!Number.isInteger(pm.park_walks_per_week) || pm.park_walks_per_week < 0 || pm.park_walks_per_week > 7) {
429:       fail(`household.members[${i}].park_walks_per_week wants 0..7`);
430:     }
431:     if (!Number.isInteger(pm.clinic_visits_per_month) || pm.clinic_visits_per_month < 0 || pm.clinic_visits_per_month > 31) {
432:       fail(`household.members[${i}].clinic_visits_per_month wants 0..31`);
433:     }
434:     if (!Number.isInteger(pm.cafe_visits_per_week) || pm.cafe_visits_per_week < 0 || pm.cafe_visits_per_week > 5) {
435:       fail(`household.members[${i}].cafe_visits_per_week wants 0..5`);
436:     }
437:     if (!Number.isInteger(pm.vet_visits_per_month) || pm.vet_visits_per_month < 0 || pm.vet_visits_per_month > 4) {
438:       fail(`household.members[${i}].vet_visits_per_month wants 0..4`);
439:     }
440:     if (typeof pm.home_office !== "boolean") {
441:       fail(`household.members[${i}].home_office wants a boolean`);
442:     }
443:     if (typeof pm.dog_walk_morning !== "boolean") {
444:       fail(`household.members[${i}].dog_walk_morning wants a boolean`);
445:     }
446:   }
```

## web/src/engine/agents.js:110–135
```
110:       id: m.id,
111:       label: m.label,
112:       role: m.role,
113:       household: true,
114:       home_building: home.buildingId,
115:       home_node: homeNode,
116:       work: m.work,
117:       school: m.school,
118:       work_unresolved: m.work_unresolved === true,
119:       plan_context: typeof m.plan_context === "string" ? m.plan_context.slice(0, 1200) : "",
120:       preferences: typeof m.preferences === "string" ? m.preferences : "",
121:       workdays: m.workdays,
122:       schooldays: m.schooldays,
123:       errands_per_week: m.errands_per_week,
124:       park_walks_per_week: m.park_walks_per_week,
125:       clinic_visits_per_month: m.clinic_visits_per_month,
126:       cafe_visits_per_week: m.cafe_visits_per_week,
127:       vet_visits_per_month: m.vet_visits_per_month,
128:       home_office: m.home_office,
129:       dog_walk_morning: m.dog_walk_morning,
130:       speed: speedOf(m.role, F),
131:     });
132:   });
133:   const n = scenario.background;
134:   if (n > 0) {
135:     const homes = anchorableHomes(area, router, F);
```

## web/src/engine/agents.js:215–245
```
215:   const allDays = Array.from({ length: days }, (_, d) => d);
216:   const rngClinic = streamFor(seed, `${key}:clinic`);
217:   for (const d of shuffled(rngClinic, allDays).slice(0, kc)) clinicDays.add(d);
218:   const vetDays = new Set();
219:   const kv = Math.min(days, agent.vet_visits_per_month || 0);
220:   const rngVet = streamFor(seed, `${key}:vet`);
221:   for (const d of shuffled(rngVet, allDays).slice(0, kv)) vetDays.add(d);
222:   // Café days: per week, the first cafe_visits_per_week Mon–Fri days
223:   // the member does not commute (a home_office workday is a home day),
224:   // in Mon→Fri order.
225:   const cafeDays = new Set();
226:   const kk = Math.min(5, agent.cafe_visits_per_week || 0);
227:   if (kk > 0) {
228:     for (let w = 0; w < weeks; w++) {
229:       const eligible = [];
230:       for (let wd = 0; wd < 7; wd++) {
231:         const d = w * 7 + wd;
232:         if (d >= days) break;
233:         const wday = WEEKDAYS[weekdayOf(scenario.start_date, d)];
234:         if (wday === "Sat" || wday === "Sun") continue;
235:         const commuting = (agent.workdays || []).includes(wday)
236:           && agent.work && agent.work.type !== "none" && !agent.home_office;
237:         if (!commuting) eligible.push(d);
238:       }
239:       for (const d of eligible.slice(0, kk)) cafeDays.add(d);
240:     }
241:   }
242:   // Morning departure jitter per day (0..59 min past the 07:30/08:00
243:   // anchors), each day from its own stream.
244:   const span = F.jitter_max - F.jitter_min + 1;
245:   const departJitter = Array.from({ length: days }, (_, d) => {
```

## web/src/engine/routines.js:766–805
```
766:   // moves earlier by the same rule so the two never overlap.
767:   if (agent.dog_walk_morning) {
768:     const cands = nearestRoundTrip(router, agent.home_node, places.parks, 1);
769:     if (cands.length === 0) {
770:       unavailable("park", "park");
771:     } else {
772:       const outMin = Math.max(1, Math.round(minutesFor(cands[0].route.lengthM)));
773:       const backMin = Math.max(1, Math.round(minutesFor(cands[0].back.lengthM)));
774:       const span = outMin + F.dog_walk_dwell_min + backMin;
775:       let depart = F.dog_walk_start_min;
776:       const workNow = agent.work;
777:       if ((agent.workdays || []).includes(weekday) && workNow
778:         && workNow.type !== "none" && !agent.home_office) {
779:         depart = Math.min(depart, F.morning_anchor_min + schedule.departJitter[day] - span);
780:       }
781:       depart = Math.max(0, depart);
782:       const cause = makeCause(schedCause,
783:         ["C-dog-walk", "C-walk-speed", "C-walk-route", "C-fatigue-load"],
784:         planConfirmed ? "확정 계획: 매일 아침 강아지 산책"
785:           : (agent.household ? "고객 입력: 매일 아침 강아지 산책" : "매일 아침 강아지 산책"));
786:       const out = addTrip(depart, cands[0].route, homeEnd(), poiEnd(cands[0].place), "park", cause);
787:       addAway(out.arrive_min, out.arrive_min + F.dog_walk_dwell_min, "park",
788:         `${cands[0].place.name} 강아지 산책`, null, cause);
789:       addTrip(out.arrive_min + F.dog_walk_dwell_min, cands[0].back, poiEnd(cands[0].place), homeEnd(), "park", cause);
790:     }
791:   }
792: 
793:   const work = agent.work || { type: "none" };
794:   const commutingToday = (agent.workdays || []).includes(weekday) && work.type !== "none" && !agent.home_office;
795:   const unresolvedCommute = agent.household && agent.work_unresolved === true && (agent.workdays || []).includes(weekday);
796:   if (unresolvedCommute) {
797:     unavailable("commute", "workplace", "근무지 입력 없음");
798:   } else if (commutingToday) {
799:     const depart = F.morning_anchor_min + schedule.departJitter[day];
800:     if (work.type === "station_ride") {
801:       if (work.place) commutePlace(work, depart);
802:       else commuteLegacy(work, depart, false);
803:     } else if (work.type === "place") {
804:       commuteToPlace(work, depart);
805:     } else if (work.type === "local_poi") {
```

## web/src/engine/routines.js:961–988
```
961:         planConfirmed ? `확정 계획: 월 ${freq}회 동물병원`
962:           : (agent.household ? `고객 입력: 월 ${freq}회 동물병원` : `월간 일정: 월 ${freq}회 동물병원`));
963:       const out = addTrip(depart, cands[0].route, homeEnd(), poiEnd(cands[0].place), "vet", cause);
964:       addAway(out.arrive_min, out.arrive_min + F.vet_dwell_min, "vet", `${cands[0].place.name} 진료`, null, cause);
965:       addTrip(out.arrive_min + F.vet_dwell_min, cands[0].back, poiEnd(cands[0].place), homeEnd(), "vet", cause);
966:     }
967:   }
968: 
969:   // --- mid-morning café (remote-work days): nearest café/library/
970:   // coworking round trip + dwell, then home. Only on days the member
971:   // does not commute; a home_office workday counts as a home day.
972:   if (!householdWeekend && schedule.cafeDays.has(day) && !commutingToday
973:     && (agent.home_office || (work && work.type !== "none"))) {
974:     const depart = Math.max(F.cafe_start_min, slotAfter());
975:     const cands = nearestRoundTrip(router, agent.home_node, places.cafes, 1);
976:     if (cands.length === 0) {
977:       unavailable("cafe", "cafe");
978:     } else {
979:       const freq = agent.cafe_visits_per_week;
980:       const cause = makeCause(schedCause,
981:         ["C-cafe-freq", "C-cafe-dwell", "C-walk-speed", "C-walk-route", "C-fatigue-load"],
982:         planConfirmed ? `확정 계획: 재택 날 주 ${freq}회 카페 작업`
983:           : (agent.household ? `고객 입력: 재택 날 주 ${freq}회 카페 작업` : `주간 일정: 재택 날 주 ${freq}회 카페 작업`));
984:       const out = addTrip(depart, cands[0].route, homeEnd(), poiEnd(cands[0].place), "cafe", cause);
985:       addAway(out.arrive_min, out.arrive_min + F.cafe_dwell_min, "cafe", `${cands[0].place.name} 작업`, null, cause);
986:       addTrip(out.arrive_min + F.cafe_dwell_min, cands[0].back, poiEnd(cands[0].place), homeEnd(), "cafe", cause);
987:     }
988:   }
```

## web/src/life/plan.js:12–40
```
12: 
13: export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
14: 
15: export const CHANGE_FIELDS = [
16:   "preferences",
17:   "workdays",
18:   "schooldays",
19:   "errands_per_week",
20:   "park_walks_per_week",
21:   "clinic_visits_per_month",
22:   "cafe_visits_per_week",
23:   "vet_visits_per_month",
24:   "home_office",
25:   "dog_walk_morning",
26:   "commute",
27:   "school",
28: ];
29: 
30: export const OBSERVATION_CODES = [
31:   "commute",
32:   "school",
33:   "errands",
34:   "walks",
35:   "remote_days",
36:   "clinic",
37:   "pet_care",
38:   "monthly_cost",
39:   "daily_variation",
40: ];
```

## web/src/life/plan.js:196–240
```
196: // user-sourced profile member values count as stated.
197: export function buildLifePlanInput({ scenario, profile = {}, messages = [], lang = "en" } = {}) {
198:   if (!isObj(scenario)) fail("scenario must be an object");
199:   const raw = scenarioMembers(scenario);
200:   if (raw.length === 0) fail("scenario needs at least one household member");
201:   if (raw.length > MAX_MEMBERS) fail(`at most ${MAX_MEMBERS} members (got ${raw.length})`);
202:   const seen = new Set();
203:   const members = raw.map((m, i) => {
204:     if (!isObj(m) || typeof m.id !== "string" || m.id.length === 0) fail(`member index ${i} needs a string id`);
205:     if (seen.has(m.id)) fail(`duplicate member id ${JSON.stringify(m.id)}`);
206:     seen.add(m.id);
207:     const assumptions = {};
208:     for (const f of CHANGE_FIELDS) {
209:       if (m[f] !== undefined) assumptions[f] = clone(m[f]);
210:     }
211:     return {
212:       id: m.id,
213:       label: str(m.label, 200),
214:       role: str(m.role, 100),
215:       work: m.work === undefined ? null : clone(m.work),
216:       work_unresolved: m.work_unresolved === true,
217:       workdays: Array.isArray(m.workdays) ? [...m.workdays] : null,
218:       schooldays: Array.isArray(m.schooldays) ? [...m.schooldays] : null,
219:       school: m.school === undefined ? null : clone(m.school),
220:       assumptions,
221:     };
222:   });
223:   const userTexts = (Array.isArray(messages) ? messages : [])
224:     .filter((m) => isObj(m) && m.role === "user" && typeof m.content === "string" && m.content.length > 0)
225:     .slice(-MAX_USER_MESSAGES)
226:     .map((m) => m.content);
227:   // Bound total evidence chars: keep the last 12 user messages, trimming
228:   // the oldest message's front when the total exceeds the cap.
229:   const texts = [...userTexts];
230:   let total = texts.reduce((n, t) => n + t.length, 0);
231:   while (texts.length > 0 && total > MAX_USER_TEXT_CHARS) {
232:     const over = total - MAX_USER_TEXT_CHARS;
233:     if (texts[0].length > over) {
234:       texts[0] = texts[0].slice(over);
235:       total = MAX_USER_TEXT_CHARS;
236:     } else {
237:       total -= texts[0].length;
238:       texts.shift();
239:     }
240:   }
```

## web/src/life/plan.js:330–382
```
330:     }
331:     if (value.mode === "nearby" && value.level === "unknown") {
332:       fail(`${memberId}.school nearby needs a known level, never unknown`);
333:     }
334:     return { mode: value.mode, level: value.level };
335:   }
336:   fail(`${memberId}.school must be false, legacy true, or {mode, level}`);
337:   return false;
338: }
339: 
340: function checkFieldValue(field, value, memberId, input) {
341:   switch (field) {
342:     case "preferences":
343:       if (typeof value !== "string" || value.length === 0) fail(`${memberId}.preferences must be a non-empty string`);
344:       if (value.length > MAX_PREFERENCES_CHARS) fail(`${memberId}.preferences exceeds ${MAX_PREFERENCES_CHARS} chars`);
345:       return value;
346:     case "workdays":
347:     case "schooldays":
348:       return checkWeekdayList(value, field, memberId);
349:     case "errands_per_week": {
350:       if (!isObj(value)) fail(`${memberId}.errands_per_week must be an object`);
351:       const keys = Object.keys(value).sort();
352:       if (keys.length !== ERRAND_KEYS.length || !ERRAND_KEYS.every((k) => keys.includes(k))) {
353:         fail(`${memberId}.errands_per_week needs exactly {supermarket, convenience}`);
354:       }
355:       return {
356:         supermarket: checkInt(value.supermarket, "errands_per_week.supermarket", memberId, 0, 7),
357:         convenience: checkInt(value.convenience, "errands_per_week.convenience", memberId, 0, 7),
358:       };
359:     }
360:     case "commute":
361:       if (value === "none") return "none";
362:       if (typeof value === "string") {
363:         const ref = /^member:([A-Za-z0-9_-]+)$/.exec(value);
364:         if (ref) return checkCommuteRef(ref[1], memberId, input);
365:       }
366:       fail(`${memberId}.commute supports only "none" or "member:<id>" (no invented destinations, routes, minutes or costs)`);
367:       return "none";
368:     case "school":
369:       return checkSchoolValue(value, memberId);
370:     case "home_office":
371:     case "dog_walk_morning":
372:       if (typeof value !== "boolean") fail(`${memberId}.${field} must be boolean`);
373:       return value;
374:     default: {
375:       const range = INT_RANGES[field];
376:       if (!range) fail(`unsupported field ${JSON.stringify(field)} (never silently dropped)`);
377:       return checkInt(value, field, memberId, range[0], range[1]);
378:     }
379:   }
380: }
381: 
382: function checkEvidence(change, memberId, input) {
```

## web/src/life/plan.js:421–471
```
421: export function validateLifePlan(raw, input) {
422:   if (!isObj(raw)) fail("plan must be an object");
423:   if (!isObj(input) || typeof input.input_signature !== "string") fail("input must carry input_signature");
424:   const topKeys = Object.keys(raw).sort();
425:   const allowedTop = ["members", "observations", "questions", "unmodeled", "review"].sort();
426:   for (const k of topKeys) {
427:     if (!allowedTop.includes(k)) fail(`unsupported top-level field ${JSON.stringify(k)}`);
428:   }
429:   for (const k of ["members", "observations", "questions", "unmodeled"]) {
430:     if (!(k in raw)) fail(`plan is missing ${JSON.stringify(k)}`);
431:   }
432:   const inputIds = (input.members || []).map((m) => m.id);
433:   if (!Array.isArray(raw.members) || raw.members.length !== inputIds.length) {
434:     fail(`plan must cover every input member exactly once (${inputIds.length} expected)`);
435:   }
436:   const seen = new Set();
437:   const members = raw.members.map((entry, i) => {
438:     if (!isObj(entry)) fail(`members[${i}] must be an object`);
439:     const ekeys = Object.keys(entry).sort();
440:     if (ekeys.length !== 2 || ekeys[0] !== "changes" || ekeys[1] !== "id") {
441:       fail(`members[${i}] allows only {id, changes}`);
442:     }
443:     if (typeof entry.id !== "string" || !inputIds.includes(entry.id)) {
444:       fail(`members[${i}] has unknown member id ${JSON.stringify(entry.id)}`);
445:     }
446:     if (seen.has(entry.id)) fail(`duplicate member id ${JSON.stringify(entry.id)}`);
447:     seen.add(entry.id);
448:     if (!Array.isArray(entry.changes)) fail(`${entry.id}.changes must be an array`);
449:     if (entry.changes.length > MAX_CHANGES_PER_MEMBER) {
450:       fail(`${entry.id} allows at most ${MAX_CHANGES_PER_MEMBER} changes`);
451:     }
452:     const changes = entry.changes.map((c, j) => {
453:       if (!isObj(c)) fail(`${entry.id}.changes[${j}] must be an object`);
454:       const ckeys = Object.keys(c).sort();
455:       const want = ["basis", "evidence", "field", "value"].sort();
456:       if (ckeys.length !== want.length || !ckeys.every((k, n) => k === want[n])) {
457:         fail(`${entry.id}.changes[${j}] allows only {field, value, basis, evidence}`);
458:       }
459:       if (!CHANGE_FIELDS.includes(c.field)) fail(`${entry.id} has unsupported field ${JSON.stringify(c.field)}`);
460:       const value = checkFieldValue(c.field, c.value, entry.id, input);
461:       const evidence = checkEvidence({ field: c.field, basis: c.basis, evidence: c.evidence }, entry.id, input);
462:       if (c.basis !== "stated" && c.basis !== "proposal") fail(`${entry.id}.${c.field} basis must be "stated" or "proposal"`);
463:       return { field: c.field, value: clone(value), basis: c.basis, evidence };
464:     });
465:     return { id: entry.id, changes };
466:   });
467:   if (!Array.isArray(raw.observations)) fail("observations must be an array");
468:   if (raw.observations.length > MAX_OBSERVATIONS) fail(`at most ${MAX_OBSERVATIONS} observations`);
469:   const observations = raw.observations.map((o, i) => {
470:     if (!isObj(o)) fail(`observations[${i}] must be an object`);
471:     const okeys = Object.keys(o).sort();
```

## web/src/life/plan.js:570–620
```
570:           delete target.commute;
571:           target.work_unresolved = false;
572:         }
573:       } else {
574:         target[c.field] = clone(c.value);
575:       }
576:     }
577:   }
578:   // A plan that newly enables the legacy boolean school keeps old behavior
579:   // but records the proxy warning, like inputs that already had it.
580:   let unmodeled = clone(clean.unmodeled || []);
581:   const setsLegacySchool = clean.members.some((e) => e.changes.some((c) => c.field === "school" && c.value === true));
582:   if (setsLegacySchool && !unmodeled.some((t) => t.includes("POI prox"))) {
583:     if (unmodeled.length >= MAX_UNMODELED) fail("unmodeled is full; legacy school proxy notice has nowhere to go");
584:     unmodeled = [...unmodeled, LEGACY_SCHOOL_PROXY_NOTICE];
585:   }
586:   // Bounded per-member observation context for daily decision prompts,
587:   // plus the scenario-level join. Defaults stay visible assumptions here,
588:   // never relabelled as measured after confirmation.
589:   const bits = [];
590:   for (const entry of clean.members || []) {
591:     const rel = (clean.observations || []).filter((o) => o.member_ids.includes(entry.id));
592:     if (rel.length === 0) continue;
593:     const text = rel.map((o) => `[${o.code}] ${o.reason}`).join(" | ");
594:     const target = byId.get(entry.id);
595:     if (target) {
596:       target.plan_context = text.length > MAX_PLAN_CONTEXT_CHARS
597:         ? text.slice(0, MAX_PLAN_CONTEXT_CHARS) : text;
598:     }
599:     bits.push(`${entry.id}: ${text}`);
600:   }
601:   let plan_context = bits.join(" / ");
602:   if (plan_context.length > MAX_PLAN_CONTEXT_CHARS) plan_context = plan_context.slice(0, MAX_PLAN_CONTEXT_CHARS);
603:   next.plan_context = plan_context;
604:   next.life_plan = {
605:     source: "muse",
606:     confirmed: true,
607:     signature: clean.input_signature,
608:     days: typeof clean.days === "number" ? clean.days : input.days,
609:     applied_members: (clean.members || []).map((m) => m.id),
610:     observation_codes: [...new Set((clean.observations || []).map((o) => o.code))],
611:     unmodeled,
612:   };
613:   return next;
614: }
615: 
616: // Civil-date weekday math (pure integer arithmetic, no Date): 2026-11-02
617: // (a Monday) anchors the week, mirroring engine/scenario.js.
618: function daysFromCivil(y, m, d) {
619:   const yy = m <= 2 ? y - 1 : y;
620:   const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
```

## web/src/life/plan.js:647–711
```
647: 
648: function countCodes(counts, codes) {
649:   let n = 0;
650:   for (const c of codes || []) n += counts[c] || 0;
651:   return n;
652: }
653: 
654: function noTravelWork(member) {
655:   if (!isObj(member)) return false;
656:   // No trip legs exist for members with no work, home office, or work that
657:   // never resolved — counts are not completed routes.
658:   if (member.work_unresolved === true) return true;
659:   if (member.home_office === true) return true;
660:   if (member.commute === "none") return true;
661:   if (isObj(member.work) && member.work.type === "none") return true;
662:   return false;
663: }
664: 
665: const METHOD_TEXT = {
666:   en: {
667:     commute: "Counts scheduled home–work trip legs the engine runs on each member's active workdays.",
668:     school: "Counts scheduled home–school trip legs on each child's active schooldays (nearby POI proxies, not enrollments).",
669:     errands: "Counts scheduled supermarket and convenience-store trip legs for the week pattern.",
670:     walks: "Counts scheduled park-walk trip legs for the week pattern.",
671:     remote_days: "Counts scheduled home-office days with no work travel legs.",
672:     clinic: "Counts scheduled clinic-visit trip legs for the month pattern.",
673:     pet_care: "Counts scheduled vet-visit and dog-walk trip legs for the routine pattern.",
674:     monthly_cost: "A separate financial assumption about monthly spending; never derived from multiplied trip counts.",
675:     daily_variation: "Compares weekday and weekend trip legs so one sample day cannot stand in for the whole window.",
676:   },
677:   ko: {
678:     commute: "각 구성원의 실제 출근 요일에 엔진이 실행하는 집–직장 이동 구간 수를 셉니다.",
679:     school: "각 자녀의 실제 등교 요일에 실행하는 집–학교 이동 구간 수를 셉니다(인근 POI 기준, 배정·입학 아님).",
680:     errands: "주간 패턴에 따른 슈퍼마켓·편의점 이동 구간 수를 셉니다.",
681:     walks: "주간 패턴에 따른 공원 산책 이동 구간 수를 셉니다.",
682:     remote_days: "출근 이동이 없는 재택 근무일을 셉니다.",
683:     clinic: "월간 패턴에 따른 병원 방문 이동 구간 수를 셉니다.",
684:     pet_care: "루틴 패턴에 따른 동물병원·산책 이동 구간 수를 셉니다.",
685:     monthly_cost: "별도의 월 지출 가정이며, 이동 횟수를 곱해서 산출하지 않습니다.",
686:     daily_variation: "평일과 주말의 이동 구간을 비교하므로, 하루 표본이 전체를 대표하지 않습니다.",
687:   },
688: };
689: 
690: // Truthful localized explanation generated by code (never by the model).
691: // Uses calendar counts for this exact start date and window; never invents
692: // improvements, fatigue, noise, daylight, safety, enrollment, or pickup
693: // coordination. monthly_cost stays a financial assumption, never trip math.
694: export function lifePlanExplanation(plan, scenario, lang = "en") {
695:   if (!isObj(plan)) fail("plan must be an object");
696:   if (!isObj(scenario)) fail("scenario must be an object");
697:   const L = lang === "ko" ? "ko" : "en";
698:   const days = Number.isInteger(scenario.days) ? scenario.days : (Number.isInteger(plan.days) ? plan.days : 30);
699:   const start = typeof scenario.start_date === "string" ? scenario.start_date : null;
700:   const counts = start ? countWeekdays(start, days) : countWeekdays("2026-11-02", days);
701:   const members = scenarioMembers(scenario).map((m) => ({
702:     id: m.id,
703:     label: typeof m.label === "string" ? m.label : m.id,
704:     work_days: noTravelWork(m) ? 0 : countCodes(counts, Array.isArray(m.workdays) ? m.workdays : []),
705:     // Only members with an enabled school schedule count school days —
706:     // never every adult carrying the parser's default schooldays.
707:     school_days: m.school ? countCodes(counts, Array.isArray(m.schooldays) ? m.schooldays : []) : 0,
708:   }));
709:   const winText = L === "ko" ? `${days}일` : `${days} days`;
710:   const headline = L === "ko"
711:     ? `이 ${winText} 창이 보여주는 것과 보여주지 않는 것`
```

## web/src/consult/life-plan.js:15–35
```
15: export const LIFE_PLAN_PROMPT = `You compose a household routine plan from the household's stated needs. You do NOT select a persona template: one scenario may mix shift work, remote work, school-age children, seniors, and pets, and every member must be served without forcing them into one persona.
16: 
17: Read the JSON user input: members (id, label, role, work, workdays, schooldays, school, assumptions), user-sourced profile values, user message quotes (user_texts), homes, start_date, days, and input_signature. Scenario routine values are ASSUMPTIONS, not stated facts. Never describe them as what the household said. Existing scenario values may carry stereotypes (seniors, remote workers, pet defaults); never present those as facts.
18: 
19: Output ONLY one JSON object with EXACTLY these keys (an optional "review" array of at most 8 strings, each <=300 chars, is also allowed):
20: {"members":[{"id":string,"changes":[{"field":string,"value":any,"basis":"stated"|"proposal","evidence":string}]}],"observations":[{"code":string,"member_ids":[string],"reason":string}],"questions":[string],"unmodeled":[string]}
21: 
22: Bounds (violations are rejected, never repaired silently):
23: - Cover every input member exactly once: no duplicates, no invented ids, no omissions. A household member mismatch is a question, never a silent omission.
24: - At most 15 changes per member, 8 observations, 8 questions, 8 unmodeled strings (each <=300 chars).
25: - Whitelisted change fields ONLY: preferences (string <=500 chars); workdays/schooldays (non-empty arrays of unique weekday codes Mon..Sun; explicit no-commute uses the commute field); errands_per_week (exactly {"supermarket":0..7,"convenience":0..7}); park_walks_per_week 0..7; clinic_visits_per_month 0..31; cafe_visits_per_week 0..5; vet_visits_per_month 0..4; home_office/dog_walk_morning (boolean); commute ("none", or "member:<id>" copying that member's ORIGINAL resolved non-none work from the input — never another patch, routes, minutes, or costs); school (false, legacy true, or {mode:"unresolved"|"nearby", level:"elementary"|"middle"|"high"|"unknown"}; nearby needs a known level and is an optional route proposal, never an assignment).
26: - basis "stated" requires evidence that is an exact substring of a USER message quote, or (any field except preferences) the exact user-sourced profile value for that same member and field. preferences evidence must always be user text, never demographic inference. Quoting is traceability, not proof: every stated extraction is reviewed by the user before anything executes.
27: - basis "proposal" stays visibly a proposal: optional routines are possible but clearly marked proposal and reviewable.
28: - Observation codes ONLY: commute, school, errands, walks, remote_days, clinic, pet_care, monthly_cost, daily_variation. member_ids must reference real input ids. Each reason is brief and specific to the stated routine.
29: - Never invent: no medical appointments for seniors, no cafes for remote workers, no vet appointments for pet owners, no shared workplace for every adult, no diagnoses or private health details — none without explicit basis.
30: - Missing workplace, school, or individual schedules are questions when the plan needs them; a child's grade or age alone never establishes school assignment. Do not demand irrelevant information: remote-only people do not need a workplace.
31: - Unknown or unsupported constraints (night shifts, accompaniment, accessibility, childcare coordination, actual catchment assignment, noise, daylight) go to unmodeled or a concrete question — never invented support.
32: - Respect stated workday and preference differences across household members.
33: - Rationale beyond brief specific observation reasons is generated by code from observations and the calendar; you only select the applicable observations.
34: - Never include totals, destinations, or any other top-level keys.`;
35: 
```

For UI only read web/src/ui/life-plan.jsx matching rg `work_days|school_days|FIELD_LABEL|home_office|workdays` +25 lines aroundhits. Preserve49bcopy.
