#49d1 — WRITE hybrid engine support now; diagnosis is complete
The previous49dspent28steps investigating withnochanges. Do not investigateagain. ThisrunONLYengine4files+newtest. Youhaveallcontextbelow. Firsttoolcallwrites helper; theneditsnamedranges. No otherfiles, no profile/context/lifeplan yet. No git/fullsuite/build. Max24steps.
1. New web/src/engine/work-schedule.js exportpureisHomeOfficeDay(member,weekday). Returnsfalseoutsideworkdays; whenhome_office_days arraypresent useincludesweekday, elselegacyhome_office===true. Explicit[]overridestrue.
2. scenario.js parseMember adds optionalhome_office_days:validatearrayallcodesMon..Sun unique, emptyallowed, subseteffectiveout.workdays, copyarray. Do notaddpropertywhenabsent, preservingoldrecordshape. checkWeekdays existingrejectemptysoownsmallvalidationhelperokay.
3. agents.js householdbuildpassarrayifpresent. cafeeligibilitycommutingconditionreplace!agent.home_office with!isHomeOfficeDay(agent,wday). No backgroundbehaviorchange.
4. routines.js importhelper, bothcommutebranchesline778and794 andcafeconditionline973 useperdayhelper (preservework.type existingfallback). unresolvedCommute ondayrequires!isHomeOfficeDaytoo sofullremoteunknownworkisnotunavailableworktrip.
5. New hybrid-engine-49d.test.js uses simulate/tinyArea/tinyScenario exactexistingfixture below. Tests: MonTueWed forhybrid TueRemote =>worktripsMonWedonly; secondmembernormalstill3days; 30daystarting2026-11-02 TueThuRemote =>13dayscommutevsnormal22; legacyhome_office true=>0; true+[]=>22; duplicate/invalidweekday/nonarray/subsetinvalidreject. No inventedhomeofficeawayevent (enginehasnohomeofficeaway, no commuteisexpected). Caféanddogexistingtestsregression.
Runonlynewtest+engine-habits-38f.test.js with --test-timeout=10000, tail15. Twofixesmaxthenstop. Writeimplementation, notanotherinvestigationreport.

## web/src/engine/scenario.js:26-42
```
26: function fail(msg) {
27:   throw new Error(`scenario: ${msg}`);
28: }
29: 
30: function checkWeekdays(list, where) {
31:   if (!Array.isArray(list) || list.length === 0) fail(`${where} needs a non-empty weekday list`);
32:   for (const w of list) {
33:     if (!WEEKDAYS.includes(w)) fail(`${where} has unknown weekday ${JSON.stringify(w)}`);
34:   }
35:   return [...list];
36: }
37: 
38: // Days from civil date (Howard Hinnant's algorithm, pure integer math)
39: // -> weekday with 2026-11-02 (Monday) as the anchor. No Date anywhere.
40: function daysFromCivil(y, m, d) {
41:   const yy = m <= 2 ? y - 1 : y;
42:   const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
```

## web/src/engine/scenario.js:325-361
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
```

## web/src/engine/agents.js:10-14
```
10: import { intBelow, shuffled, streamFor } from "./prng.js";
11: import { criterionDefault, defaultFlat, resolveCriteria } from "./criteria.js";
12: import { WEEKDAYS, weekdayOf } from "./scenario.js";
13: 
14: // Defaults alias the criteria file (C-walk-speed, C-neighbour); per-run
```

## web/src/engine/agents.js:110-134
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
```

## web/src/engine/agents.js:222-244
```
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
```

## web/src/engine/routines.js:24-26
```
24: import { destForHome, nameForHome, rideMinutesForHome, waitMinutesForHome, weekdayOf, WEEKDAYS, dateOf } from "./scenario.js";
25: import { MAX_ANCHOR_M, nearestRoundTrip, poisByName, stationsByName } from "./places.js";
26: import { ruleDefault, WEEKEND_HOME } from "./decisions.js";
```

## web/src/engine/routines.js:772-800
```
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
```

## web/src/engine/routines.js:968-979
```
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
```

## web/tests/engine-habits-38f.test.js:1-44
```
1: // Stage 38f: household habits — café on remote days, a morning dog
2: // walk, a vet visit. Reuses the shared tiny fixture (no new data files);
3: // café/vet POIs are pushed onto the fixture area in-test.
4: import { describe, it } from "node:test";
5: import assert from "node:assert/strict";
6: import { simulate } from "../src/engine/simulate.js";
7: import { tinyArea, tinyScenario } from "./engine-fixture.js";
8: 
9: const STATION_WORK = {
10:   type: "station_ride", station_name: "중앙역", ride_minutes: 20,
11:   ride_minutes_source: "user_assumption",
12: };
13: 
14: // Fixture area plus one reachable café and one reachable vet (same
15: // coords as existing anchored POIs, so both stay within MAX_ANCHOR_M).
16: function habitArea() {
17:   const area = tinyArea();
18:   const at = (lon, lat) => ({ type: "Point", coordinates: [lon, lat] });
19:   area.pois.push(
20:     { id: "cafe1", name: "카페", category: "amenity:cafe", osm_kind: "node",
21:       osm_id: 2, geometry: at(127.001, 37.5001) },
22:     { id: "vet1", name: "동물병원", category: "amenity:veterinary",
23:       osm_kind: "node", osm_id: 3, geometry: at(127.0011, 37.5001) },
24:   );
25:   return area;
26: }
27: 
28: function member(over = {}) {
29:   return {
30:     id: "m1", label: "구성원 1", role: "adult",
31:     workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
32:     work: { ...STATION_WORK },
33:     errands_per_week: { supermarket: 0, convenience: 0 },
34:     park_walks_per_week: 0, clinic_visits_per_month: 0,
35:     ...over,
36:   };
37: }
38: 
39: function scFor(days, members, seed = 42) {
40:   const sc = tinyScenario({ days, seed, background: 0 });
41:   sc.household.members = members;
42:   return sc;
43: }
44: 
```
