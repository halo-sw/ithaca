# Ithaca final recording, revision 9

The 173.02-second English video follows one illustrative Korean couple from their input through a reviewed routine and an actual live Muse month. Its saved run is `cmw0nibca873f`. The four-person family is a separate run, `cmw0opz1800db`. These financial and household conditions are hypothetical examples, not the founder's personal finances.

## Why Muse is in the product

1. **Plan each member's routine.** Muse interprets working days, remote days, errands, school levels and stated preferences. The customer reviews explicit inputs, proposed assumptions, unanswered questions and unsupported conditions before execution.
2. **Make bounded daily choices.** At a choice point, Muse receives that person's routine, today's activity, recent choices and map-backed options. It returns an allowed choice and an explanation. The saved record retains those options, the chosen key and the actual model or fallback provenance.
3. **Check statements against evidence.** Code checks supported numerical claims against engine values. A separate Muse call evaluates supported semantic claims against cited events. Missing, erroneous or malformed semantic checks produce an unverified result rather than a pass.

Code calculates paths, time and costs. Fixed work/school schedules and background residents use code. Muse's explanation describes its simulated choice; it does not validate how a real person would behave.

## Why 30 days

This chosen comparison window repeats workdays, remote days, weekends and recurring errands under the same reviewed scenario in both homes. The couple's first adult has 22 onsite workdays; the partner has 13 onsite days and 9 remote days in this calendar. Thirty days is not a validated minimum and the run is not a prediction of real life.

## The couple's actual input

> We are an example couple buying our first home, up to 700 million won, with 200 million won saved. Our annual salaries are 50 and 45 million won. We both work near Pangyo Station; use the station as our explicit workplace assumption. I commute Monday to Friday and prefer quick grocery stops. My partner commutes Monday, Wednesday and Friday, works from home Tuesday and Thursday, and enjoys evening park walks. Each of us makes one supermarket trip and one convenience-store trip, plus two park walks per week. Accept the default departure times and work duration as simulation assumptions. Minimum size 25 square meters, commute under 60 minutes. Find homes to compare.

## Results from this run

| Home | Average one-way commute | Loan + maintenance | Recorded commute fares | Monthly housing + commute | Historical transaction area band |
|---|---:|---:|---:|---:|---:|
| A: 판교역 근처 오피스텔 (647) | 4.8 min | ₩509,790 | ₩0 | ₩509,790 | 25–35 m² |
| B: 미래하이빌 | 23.9 min | ₩915,417 | ₩108,500 | ₩1,023,917 | 55–65 m² |

The main comparison includes housing and commute. The report's housing-only cost is a different quantity and is not substituted for this total. Both references are historical transaction medians, not available listings or exact unit sizes. Loan terms, maintenance and workplaces near named stations are assumptions, not borrowing eligibility or actual office-door measurements.

Actual choice provenance: `{"A": {"model": 70}, "B": {"model": 63, "rule_fallback": 2}}`. No previous run's choice or result is inserted into this record.

## The choice shown in the video

Home A, Day 2, decision `h2:d1:0960:park_or_home:00`. Member: Partner. Stated preference: Enjoys evening park walks..

Available options: [{"key": "park", "label": "모자이크파크", "minutes": 5.1, "distance_m": 398.7, "poi_id": "w469361456"}, {"key": "home", "label": "집", "minutes": 0, "distance_m": 0}].

Chosen: 모자이크파크. Saved English reason:

> Matches evening park walk routine on remote workday

The engine baseline displayed beside the choice is a default, not a separately observed real-world or full-month counterfactual run.

## Verification

Actual saved report status: `pass`. The attached report evidence retains all attempt outcomes and sentence-level checks. The video reports this actual outcome; no deliberately failed test is staged as this household's result. Coverage applies to supported internal checks, not field accuracy. Unsupported facts such as real noise and daylight remain outside the verdict.

## Separate four-person family

> We are an example family of four: two working parents and two children. Both parents work near Jamsil Station. We both commute five days a week; use the station as an explicit workplace assumption. Child 1 attends elementary school and child 2 attends middle school, Monday to Friday. We have no assigned schools: use the nearest mapped school matching each level as a route assumption only, without inferring enrollment or catchment. Our annual salaries are 80 and 70 million won, savings 500 million won, purchase budget 1.5 billion won, minimum size 80 square meters, a 45-minute one-way commute limit. Each parent makes one supermarket trip, one convenience-store trip and one park walk per week. Each child takes one park walk and has no shopping errands. Accept default work and school departure times and durations as simulation assumptions. Find homes to compare.

> Both parents commute Monday to Friday, every week. Enrollment and catchment must stay unmodeled: we only want the nearest mapped elementary-school route for Child 1 and middle-school route for Child 2 as explicit assumptions. Confirm all other routines and default times already stated.

The parents' routines, elementary-school route and middle-school route retain their separate members and calendars. School destinations are mapped POIs matched to stated school level. In this actual run, Home A has no matching mapped middle-school route: the 22 missing schooldays remain unavailable, rather than being counted as zero-minute journeys. Home B records 22 elementary- and 22 middle-school days. Enrollment, assignment and catchment remain unmodeled. Run `cmw0opz1800db` is never substituted for the couple's record.

## Map coverage

The local neighborhoods use actual map geometry and imagery. Detailed terrain and imagery have finite coverage: some long transit corridors still show fallback ground beyond loaded areas. The video shows actual local journeys and does not establish continuous aerial coverage of every route.

## Model and editing credits

Spark 1.3 produced this month's plan, bounded daily choices and report workflow. Spark Open is shown as a selectable alternative; the video does not claim it produced this month. Muse Voice transcribes spoken input. Muse Code authored product implementation and regression tests. The presentation's English narration was synthesized separately with en-US-AndrewMultilingualNeural; it is not product Muse Voice output.

Model waits and saved 3D playback are condensed for pacing. Full raw captures remain local. The edit manifest records clip sources, timings and crops. The main UI footage, numerical claims, plan and verification are from the same saved month. Supplied Ithaca branding is retained; Meta branding is limited to the relevant model/agent scenes. Cover and ending art are conceptual illustrations, not property photographs.

## Validation and reproducibility

Recorded product commit: `b4c6e6b8a12bc4db6e18c0d5d222f456302b2429`. Public frontend bundle at recording: `index-BVfJHGGl.js`. The frontend and API were deployed before these runs. Stage 49 product validation: 3,728 JavaScript tests passed, 3 skipped; production build succeeded; Astryx had no failures; PRs #38 and #39 passed JS/build, Python and Docker checks. Later frontend-only fixes preserve saved Muse provenance, English reasons and A/B choice counts, round display minutes, clear hover tooltips and select this unchanged saved record. Provenance tests: 33 passed; routine display tests: 30 passed. PR #40 CI passed 3,655 JavaScript tests, with 42 fixture-dependent skips, plus Python and Docker smoke checks. The production source audit passed 20 checks with 3 existing warnings and no failures. A project-wide Astryx scan also flags test fixtures that intentionally import themes without CSS; the production-only audit excludes those fixtures.

- Couple record SHA-256: `2d6fae0bbeba5aa699b771c897d19614a5cce5bf214fb1b9b2101ac91d2436d9`.
- Family record SHA-256: `039c593dc7fc4484f37227c6168b55e0bf106fc8323fac0c8e7fd3ec6c6284ae`.
- Video SHA-256: `37c25006e859ff1e490b5d87007cd0ed47e90ae5b91d2d87d631e8e9b471fc11`.
- Final video: 173.021 seconds, 1920×1080, 30 fps, English narration and captions.

The evidence manifest, complete saved runs, sanitized transcripts, script, subtitles and independent video/numerical QA accompany the package. Public replay: https://halo-sw.github.io/ithaca/?replay=pangyo-reviewed-month&lang=en

Anonymous public replay was checked after PR #40 deployment: no model calls, exact same scenario, both runs and money data restored. See `ithaca-public-replay-qa.json`.

A user field study, YouTube upload with signed-out playback verification, and submission-form completion have not been performed as part of this update.
