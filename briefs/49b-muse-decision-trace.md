# 49b — Make the saved Muse decisions inspectable
User asks for a sharper, more concrete Muse use case before the final video. This part is about actual records, not added claims. Product authored by Muse only. No git/fullsuite/build/exploration. <=25steps, focused tests only.

Implement one pure module web/src/chat/decision-trace.js and wire existing household decisions section only:
- makeHouseholdDecisionExamples(run, members) returns at most4 saved examples covering actual household agents first, then a different decision kind and/or nondefault choice. Stable chronology tiebreak, no cherry-picked reasontext. Prefer first changed-default example per member if there is one, else first recorded choice; disclose selection policy in UI. Distinct IDs; retain unknown/nonmodel labels. Never invent values for missing data.
- Preserve raw decisions/run. Build each example with existing fields plus id, member label/preferences from scenario membership matching household agent order (verify mapping in run.agents), options/default_key, actual chosen option time/distance, provider/model. Array plan handling must be exact (including stayhome), no treating absent chosen_key as default change. Unknownminutes null, never0.
- Display 'How Muse chose' with concise intro 'Examples from this run: one per member where available, plus different choice types. Changed defaults appear first.' Keep readable: member + day/time; stated preference (only if present); available options label+minutes from saved shell; chosen/default labels (default clearly engine baseline, not observed counterfactual); saved exactreason; source Muse or explicitrulefallback; existing link toexactmoment. No causalbenefit/savings claims; no unstoredmemory claims. Default expanded? Use existing details closed to avoid bloatedresult; afterclick showcleanreadabledecision rows. Use Astryx VStack/Text existing SceneRowLink no rawdiv/span/CSS/rawpx.
- Keep old transcript payloads compatible (nooptions etc stilldisplay existingreason/link).
- At run payload creation replace current first3mapping with helper, pass actual scenValue.household.members. helper followindex samehouseholdmapping.
- Add short plan review copy clarifying division: 'Muse proposes routines and chooses among recorded options. The engine calculates routes, time and cost.' Korean equivalent. Make30daysreason specific repetition ofworkingdays/weekends/errands underconfirmedplan, not validatedminimum.
- focused tests requiremembercoverage, actualnondefaultselection, unique+stable, weekendplan/home handling, unknownoptionminutes nozero, no mutation, oldpayload compatibility whereappropriate. Runnewtests plus any relevant existing lifeplanUI snapshots (onlyifneeded).

Allowed reads: excerpts pasted below, web/src/ui/life-plan.jsx lines1–125 and locate title/render anchor via rg then<=45lines aroundhit; web/tests/plan-display-47j.test.js ifexists forSSRpatterns. Do not readwholechat.jsx.

## web/src/ui/chat.jsx:100–125
```
100:   profileSummary, missingChips, regionsForNames, simReadyFor,
101:   homeForScenario, complexNameForCandidate, stationNames,
102:   runGate, profileHomeKinds, regionsForCurrency, regionsForDoc,
103:   usSearchActive, decisionProvenance, missingRouteHomes,
104: } from "../chat/engine.js";
105: import { LifePlanCard, LifePlanRunSummary } from "./life-plan.jsx";
106: import { buildReviewInput, requestPlanReview, findFreshReview,
107:   reviewSnapshot, sameSnapshot, createPlanGuard, isConfirmFresh,
108:   isConfirmedWorkerFresh,
109:   createConfirmedTransaction } from "../chat/life-plan-flow.js";
110: import { confirmLifePlan, applyLifePlan, summarizePlanRun } from "../life/plan.js";
111: import { fetchDataJson, fetchDataText } from "../data-fetch.js";
112: import { buildCustomMoneyDoc, buildUsRentMoneyDoc, verifyHomeFor } from "../chat/custom-money.js";
113: import { personaFor, slimRunForReport } from "../verify/compare.js";
114: import { newCustomId, saveCustomRun, loadCustomRun } from "../chat/idb.js";
115: import { chatUrl, simMomentUrl, tourUrl, withoutEmbed, saveTranscript, loadTranscript,
116:   clearTranscript, parseChatSearch } from "../chat/urls.js";
117: import { recordingUrl, validateRecording, replaySchedule, replayRunPlan, restoreReplayRun, RECORDINGS } from "../chat/recording.js";
118: import { ruleTurnPlan, isRunRequest } from "../chat/intent.js";
119: import { postConsultStream, postDiary, postReportStream, loadScenario, basetenFallbackProvider, postDecision, postLifePlan } from "./consult-client.js";
120: import { loadProviderChoice, saveProviderChoice, isValidProvider,
121:   offerOpenWeights, providerLabel, openFallbackLine, recordedModelOf,
122:   OPEN_MODEL_HINT } from "./provider-switch.js";
123: import { shouldCallMuse, isNoKeyError, KEYLESS_LINE,
124:   getMuseLive, getMuseStatus, subscribeMuseLive, setMuseLive, refreshMuseLive } from "./muse-status.js";
125: import { voiceSupported, voiceKeyReady } from "./voice.js";
```

## web/src/ui/chat.jsx:1274–1296
```
1274: // never an internal key like s0/park. houseDecisions carries the
1275: // persisted option label; home stays language-aware at display time.
1276: export function decisionChoiceLabel(d) {
1277:   const en = LANG === "en";
1278:   const isHome = Array.isArray(d.plan) ? d.plan.length === 0 : d.chosen_key === "home";
1279:   if (isHome) return en ? "Stay home" : (d.chosen_label || "집");
1280:   return d.chosen_label || d.chosen_key || "";
1281: }
1282: 
1283: export function decisionWhen(d) {
1284:   return LANG === "en"
1285:     ? `Day ${d.day + 1} ${hhmm(d.minute)}`
1286:     : `${d.day + 1}일차 ${hhmm(d.minute)}`;
1287: }
1288: 
1289: function decisionPreviewText(d) {
1290:   const en = LANG === "en";
1291:   const reason = en ? (d.reason_en || d.reason_ko) : (d.reason_ko || d.reason_en);
1292:   const chosen = decisionChoiceLabel(d);
1293:   const src = d.chosen_by === "model" ? "Muse" : (en ? "rule" : "기본");
1294:   return reason ? `${chosen} — ${reason} · ${src}` : `${chosen} · ${src}`;
1295: }
1296: 
```

## web/src/ui/chat.jsx:1377–1402
```
1377:         {Array.isArray(data.houseDecisions) && data.houseDecisions.length > 0 && (
1378:           <details className="ui-section">
1379:             <summary className="ui-section-head">
1380:               {LANG === "en" ? "Household decisions" : "식구들의 선택"}
1381:             </summary>
1382:             <VStack gap={1}>
1383:               {data.houseDecisions.map((h) => (
1384:                 <VStack gap={1} key={h.label}>
1385:                   {h.items.map((d, i) => (
1386:                     <SceneRowLink key={i} disc={h.label}
1387:                       when={decisionWhen(d)}
1388:                       text={decisionPreviewText(d)}
1389:                       url={personMomentUrl({ custom: data.customId, home: h.label,
1390:                         day: d.day + 1, minute: d.minute, follow: d.follow || 1, embed: true })}
1391:                       title={`${decisionWhen(d)} · ${h.label}`}
1392:                       onScene={onScene} noI18n={LANG === "en"} />
1393:                   ))}
1394:                 </VStack>
1395:               ))}
1396:             </VStack>
1397:           </details>
1398:         )}
1399:         {texts.length > 0 && (
1400:           <VStack gap={2}>
1401:             <span className="ui-result-sect">살아 보니</span>
1402:             {texts.map((t, i) => {
```

## web/src/ui/chat.jsx:4390–4433
```
4390:       // rule run called a Muse run), plus the first real household
4391:       // decisions per home with their saved reasons — plain data, so
4392:       // the transcript reload carries them.
4393:       const decisionMode = museDecisions ? "muse" : "rule";
4394:       const provenance = decisionProvenance(runs, labels);
4395:       const houseDecisions = labels.map((l) => {
4396:         const run = runs[l];
4397:         const keys = ((run && run.agents) || [])
4398:           .filter((a) => a.household).map((a) => a.key);
4399:         const items = ((run && run.decisions) || [])
4400:           .filter((d) => String((d && d.agent) || "").startsWith("h"))
4401:           .slice(0, 3)
4402:           .map((d) => {
4403:             // 44b2: persist the chosen option's label (shop name, …)
4404:             // from the saved shell options — never a raw key.
4405:             const opts = Array.isArray(d.options) ? d.options : [];
4406:             const nameOf = (key) => {
4407:               const o = opts.find((x) => x && x.key === key);
4408:               return (o && typeof o.label === "string" && o.label) || null;
4409:             };
4410:             const chosen_label = Array.isArray(d.plan)
4411:               ? (d.plan.length === 0
4412:                 ? (nameOf("home") || "")
4413:                 : d.plan.map((k) => nameOf(k) || k).join("+"))
4414:               : (nameOf(d.chosen_key) || "");
4415:             return {
4416:               agent: d.agent, day: d.day, minute: d.minute, kind: d.kind,
4417:               chosen_key: d.chosen_key, chosen_label,
4418:               ...(d.plan !== undefined ? { plan: d.plan } : {}),
4419:               chosen_by: d.chosen_by,
4420:               reason_ko: d.reason_ko || "", reason_en: d.reason_en || "",
4421:               follow: keys.indexOf(d.agent) >= 0 ? keys.indexOf(d.agent) + 1 : 1,
4422:             };
4423:           });
4424:         return { label: l, items };
4425:       });
4426:       // 47l: a confirmed run carries its plan and the summary computed
4427:       // above from the actual runs; rule runs omit both (no Muse claim).
4428:       const payload = { status: "done", compare, moments, labels, customId, personLog,
4429:         decisionMode, provenance, houseDecisions,
4430:         ...(extras ? { lifePlan: extras.plan, lifePlanSummary: lifeSummaries } : {}),
4431:         start_date: (scenValue && scenValue.start_date) || "2026-11-02",
4432:         ...(wpName ? { workplace: wpName } : {}),
4433:         // 29M1: English reports and headers read Muse's registered home
```

## Actual saved record examples (read-only context)
```json
{
  "agents": [
    {
      "key": "h1",
      "id": "m1",
      "label": "나",
      "role": "adult",
      "household": true,
      "home_building": "w455409536",
      "home_node": "n002263"
    },
    {
      "key": "h2",
      "id": "m2",
      "label": "배우자",
      "role": "adult",
      "household": true,
      "home_building": "w455409536",
      "home_node": "n002263"
    }
  ],
  "decisions": [
    {
      "id": "h1:d0:1074:shop_choice:00",
      "agent": "h1",
      "day": 0,
      "minute": 1074,
      "kind": "shop_choice",
      "options": [
        {
          "key": "s0",
          "label": "No Brand",
          "minutes": 2.7,
          "distance_m": 207.86,
          "poi_id": "n5068287430"
        },
        {
          "key": "s1",
          "label": "롯데마트 판교점 (Lottemart)",
          "minutes": 4.4,
          "distance_m": 340.97,
          "poi_id": "n4318273933"
        }
      ],
      "default_key": "s0",
      "chosen_key": "s0",
      "chosen_by": "model",
      "reason_ko": "퇴근 후 가볍게 들르기 좋은 동선이라서",
      "reason_en": "Back from work and prefers a quick nearby stop",
      "provider": "meta",
      "model": "muse-spark-1.3",
      "usage": {
        "prompt_tokens": 495,
        "completion_tokens": 1108,
        "reasoning_tokens": 1055
      },
      "latency_ms": 3528,
      "decided_by": "에이전트"
    },
    {
      "id": "h1:d0:1125:park_or_home:01",
      "agent": "h1",
      "day": 0,
      "minute": 1125,
      "kind": "park_or_home",
      "options": [
        {
          "key": "park",
          "label": "모자이크파크",
          "minutes": 5.1,
          "distance_m": 398.7,
          "poi_id": "w469361456"
        },
        {
          "key": "home",
          "label": "집",
          "minutes": 0,
          "distance_m": 0
        }
      ],
      "default_key": "home",
      "chosen_key": "home",
      "chosen_by": "model",
      "reason_ko": "퇴근 후 장을 보고 돌아와 집에서 쉬기 좋아서",
      "reason_en": "Back home after work and errands, prefers quiet evening routine",
      "provider": "meta",
      "model": "muse-spark-1.3",
      "usage": {
        "prompt_tokens": 562,
        "completion_tokens": 1408,
        "cached_tokens": 241,
        "reasoning_tokens": 1358
      },
      "latency_ms": 4613,
      "decided_by": "에이전트"
    }
  ]
}
```
