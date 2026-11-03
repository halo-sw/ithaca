<p align="center"><img src="briefs/img/ithaca-banner.png" width="100%" alt="Ithaca — The Pre-living Agent for Your Next Home"></p>

# Ithaca

**Before you sign, live the next 30 days.**

Built from scratch since [October 28, 2026](https://github.com/halo-sw/ithaca/commit/7fec53140d26cc100392126fa76029909c0ff1a3) by **Halo, solo**, for **Meta Hackathon 2026**. Track: **Indie Developer**. Problem statement: **Build for Your World**.

**[Try the app](https://halo-sw.github.io/ithaca/?lang=en)** · **[Watch the published demo — 2:53](https://github.com/halo-sw/ithaca/releases/download/demo-v9/ithaca-hackathon-final-en.mp4)** · **[Replay the recorded month — no key](https://halo-sw.github.io/ithaca/?replay=pangyo-reviewed-month&lang=en)** · [한국어](README.ko.md)

Published demo: revision 9, with English synthesized narration and captions.

## 1. Project introduction

Ithaca helps people understand how a home could fit their household's daily life before they commit to it. You describe the people, schedules, budget and preferences; review a plan proposed by Muse; and compare 30 simulated days in two candidate homes.

The result connects each person's routines to routes, time, costs and recorded choices. You can inspect the evidence and follow a journey in 3D, then decide what to check at a real viewing.

## 2. Service summary

| You provide | Ithaca returns |
|---|---|
| Household members, workplaces, budget and preferences | Candidate homes on a map, with historical transaction references |
| Two selected homes and reviewed routines | The same household simulated over the same 30-day window in both homes |
| Your questions and priorities | Side-by-side costs and commutes, saved decisions with reasons, and a report linked to its evidence |

Current scenarios cover parts of Seoul and Gyeonggi, including Jamsil and Pangyo, and a separate Menlo Park / Meta HQ case. Plans can combine working adults, remote days, children, older members and pets. Missing or unsupported needs stay visible.

Historical transaction prices are reference data, not available listings. US rent inputs include ZIP-level estimates. Sources, assumptions and coverage limits are part of the comparison.

## 3. Problem definition

**A short viewing leads to a long commitment.** First-time buyers and renters need to choose a place where several people's lives must work. Photos, floor plans and prices reveal the property; they leave the household to work out its everyday consequences.

**In Korea, this decision can feel rushed.** A day of traveling between neighborhoods may still end with pressure to decide. A couple must weigh two commutes, office and remote days, shopping trips and time at home. A family adds school routes and other routines. A poor fit creates recurring costs in time and money after moving in.

**The missing information is household-specific.** A single route search does not show how different schedules and recurring activities add up across a month. Ithaca turns those conditions into an explicit, reviewable comparison and a set of questions to take to the viewing.

Korean public transaction records, building data and transit data provide useful inputs. They do not establish the accuracy of a simulated life. Deposit-risk checks are a separate feature; a 30-day simulation cannot certify a lease or prevent deposit fraud.

## 4. How the Muse agents work

**Muse proposes routines and makes bounded choices. Code computes the consequences. The report is checked against the saved run.**

| Role | What happens | What makes it inspectable |
|---|---|---|
| Consultation | Muse uses tools to extract the household profile and search recorded housing data | Stated inputs and missing information stay distinct |
| Planning | Muse proposes each member's working days, remote days, errands and supported routines | The user reviews assumptions; **Adjust my routine** sends a correction back to Muse before confirmation |
| Daily decisions | At a choice point, Muse receives the person's preferences, routine, recent choices and map-backed options | It returns an allowed choice and reason; the record retains the options and model or fallback source |
| Simulation | The browser worker applies fixed schedules and computes routes, elapsed time and costs | Values come from the engine and its inputs; background residents use rules |
| Report and checks | Muse writes from the saved record; code checks supported numbers and evidence IDs; a separate Muse call checks eligible claims against cited events | Failed claims return for revision. Missing or failed semantic checks remain **unverified**; unsupported items are not counted as passes |

**One recorded decision:** in the published Pangyo run, the partner's options on a remote day were a park walk or staying home. Muse chose the park and saved the reason, “Matches evening park walk routine on remote workday.” The engine computed the 5.1-minute walk. This is an observed simulated choice, not evidence of what a real person would do. [Decision, options and run](docs/recording-v9.md#the-choice-shown-in-the-video).

### Where the models run

The **browser** hosts the UI, 3D playback and simulation worker. A **relay server** on Vercel (or local Docker) makes runtime model calls. Hosted service keys stay in the relay's environment. An optional user-supplied key is sent with that user's request.

| Model / tool | Job | Where it runs | API used by Ithaca | Evidence |
|---|---|---|---|---|
| **Muse Spark 1.3** | Consultation, plans, bounded choices, reports and separate evidence checks | Relay → Meta Model API | `api.meta.ai/v1/chat/completions` | [Provider](web/src/judge/providers.js), [recorded month](docs/recording-v9.md) |
| **Muse Spark Open** | Selectable alternative for supported text-agent tasks | Relay → Baseten inference | `inference.baseten.co/v1/chat/completions` | [Real calls](docs/evidence/muse-spark-open-2026-10-31.json), [comparison](docs/model-comparison.md) |
| **Muse Voice Transcribe 1.0** | Turns spoken input into editable text | Browser records audio; relay → Meta | `api.meta.ai/v1/asr/transcribe` | [Voice handler](web/src/consult/voice.js) |
| **Muse Image 1.0** | Illustrates a recorded activity using its kind, time and region | Relay → Meta | `api.meta.ai/v1/images/generations` | [Handler](web/src/consult/diary-image.js), [real calls](docs/evidence/muse-image-2026-11-03.json) |
| **SAM 3.1** | Finds window boxes in a supplied room image | Browser prepares image; relay → Meta | `api.meta.ai/v1/responses` | [Handler](web/src/consult/windows.js), [real call](docs/evidence/sam-3.1-2026-11-03.json) |
| **Muse Code** | Implements product code, tests and pipelines from development briefs | Developer's environment, during development only | No runtime application endpoint | [Briefs](briefs/), [repository rules](AGENTS.md) |

Muse Image outputs carry **“Illustration by Muse Image”** labeling; they are not photographs of the property. SAM reports boxes and their share of the image, not physical window dimensions or daylight performance. Its published call used an illustrated test room. These integrations are separate from the evidence for the 30-day comparison.

The app exposes its agent work through **“Plan proposed by Muse,” “Muse is choosing…”** and recorded choice sources. The principal published month used **Spark 1.3**; selecting Spark Open in the UI is not evidence that it produced that run. Human and orchestration work covered direction, briefs, checks and presentation preparation; Muse Code was the implementation tool. [Full architecture](docs/architecture.md) · [Verification rules](docs/verification.md) · [Model evidence](docs/evidence/README.md).

## 5. Main service flow

1. **Describe the household.** Enter or speak the people, budget, destinations and preferences.
2. **Pick two homes.** Inspect candidates, transaction references and map coverage.
3. **Review and adjust the plan.** Read each member's proposed routine. Use **Adjust my routine** to change a condition, review Muse's revision, then confirm.
4. **Run the month.** Muse chooses among allowed options while code computes the consequences. A live run may take a few minutes; the UI shows progress and any fallback state.
5. **Inspect the comparison.** Open costs, commutes, source tags and the actual report-check timeline. Follow a saved decision's journey in 3D.
6. **Prepare for the real viewing.** Use the differences and unresolved questions to guide what you check. The user makes the housing decision.

**Why 30 days?** About four weekly cycles repeat working days, remote days, weekends and errands under the same reviewed conditions in both homes. The UI compares **First 7 days** with the **Full period**, including when extra days add little information. Thirty days is a chosen comparison window, not a validated minimum or a forecast. Monthly housing costs use separate financial assumptions.

### What the published run demonstrates

One illustrative Pangyo couple, one saved run: **`cmw0nibca873f`**. The table below reproduces the values behind the linked v9 video and replay.

| Metric | Home A | Home B |
|---|---:|---:|
| Average one-way commute | 4.8 min | 23.9 min |
| Monthly housing + recorded commute costs | ₩509,790 | ₩1,023,917 |
| Historical transaction area band | 25–35 m² | 55–65 m² |
| Saved Muse choices / rule fallbacks | 70 / 0 | 63 / 2 |

The report's saved status is **pass**. This checks internal consistency with the record, not field accuracy. The transaction bands are not exact unit sizes; station-based workplaces, loan terms and maintenance are explicit assumptions. [Inputs, calculations and limits](docs/recording-v9.md) · [Machine-readable evidence](docs/evidence/recording-v9.json).

A **separate four-person family run** records school-level routes. A missing middle-school route remains unavailable; school assignment and enrollment are not inferred. [Family evidence](docs/recording-v9.md#separate-four-person-family).

<details>
<summary>Other evaluations and ways to try it</summary>

- [Commute baseline analysis](docs/baseline-commute.md): a rule-based, ten-seed comparison against a constructed station-distance-plus-ride baseline. It is separate from the live Muse month and from real-world measurements. Korean platform waits are not modeled in that analysis.
- [Spark 1.3 vs Spark Open](docs/model-comparison.md): a separate model comparison on shared decision points; agreement is not an accuracy score.
- [Try Meta HQ](https://halo-sw.github.io/ithaca/?chat=I+work+at+Meta+HQ+in+Menlo+Park.+Two+of+us%2C+rent+up+to+%244%2C500+a+month.&lang=en).
- [Run locally](docs/development.md): Docker, source setup and data regeneration. Without a configured provider, local execution uses labeled rule mode. Public live use is subject to shared model limits; the saved replay needs no live model call.
- [CI](https://github.com/halo-sw/ithaca/actions/workflows/ci.yml) · [Features](docs/features.md) · [Data attribution](ATTRIBUTION.md).

</details>

## 6. Conclusion

Ithaca makes the everyday consequences of a housing choice visible and inspectable: a reviewed household plan, saved decisions, computed trade-offs and an evidence-linked report. The prototype demonstrates that workflow with real model calls and public-data inputs.

The useful outcome is a better-informed viewing and a clearer comparison. The final decision remains with the household.

## 7. Expected impact and next steps

The intended benefit is **less mental work when comparing homes, earlier discovery of routine mismatches, and clearer conversations about time and money**. These are goals to test, not measured customer outcomes.

| Next step | What to validate |
|---|---|
| Field study with 10–20 residents | Compare modeled journeys and costs with observed routines; record errors and whether the comparison changes the questions people ask |
| Broader route and data coverage | Improve missing destinations, workplace precision and transit assumptions; keep unresolved inputs visible |
| More household needs | Validate school-route data and coordination requirements before claiming support; retain explicit limits for enrollment, noise and daylight |
| Photo-based assistance | Evaluate window detection on real room photos before adding physical measurements or environmental claims |

Start with your household, inspect the assumptions, and use the result to ask better questions before you sign.

---

[Architecture](docs/architecture.md) · [Planning and the 30-day window](docs/household-planning.md) · [Build log](docs/build-log.md) · [Local setup](docs/development.md) · [Recording script](docs/demo-script.md)

Code: [MIT](LICENSE). Data, imagery and fonts retain their own licenses; see [ATTRIBUTION.md](ATTRIBUTION.md).
