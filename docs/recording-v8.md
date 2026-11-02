# Revision 8 recording — 3 November 2026

The main story follows one example Pangyo couple, one saved run: `cmvzm1bok85ad`. The separate family extension is `cmvzm6kczd730`. The new narrated video is 2:51 and is packaged locally; it has not replaced the older public release video.

## Main input and result

> We are a couple working near Pangyo Station. Purchase budget: 700 million won. Savings: 200 million won. Annual salaries: 50 million won and 50 million won.

These are example financial inputs, not the founder’s personal finances. The two homes are selected before running the month.

| | A: Officetel near Pangyo Stn (647) | B: Mirae Hi Ville |
|---|---:|---:|
| Average one-way work journey | 4.8 min (display 5) | 23.9 min (display 24) |
| Loan payment + maintenance | ₩509,790/month | ₩915,417/month |
| Recorded commute fares | ₩0 | ₩136,400 |
| Housing + commute | ₩509,790 (display ₩510,000) | ₩1,051,817 (display ₩1,052,000) |
| Transaction area band | 25–35 m² | 55–65 m² |
| Transaction reference | ₩262,000,000 / 7 deals | ₩355,000,000 / 1 deal |
| Live household choices by Muse | 69 | 65 |
| Guard fallback choices | 0 | 0 |

Source: the saved run and its money document. Monthly costs assume 4% interest, a 30-year loan and ₩150,000 maintenance. Transport is separate from the housing-only claims in the report. Historical transaction bands are not live asking prices or exact unit sizes. Work is modeled near Pangyo Station, not at a known office door. The simulation does not cover all real costs or determine borrowing eligibility.

## Actual agent behavior

At A / Day 1 / 17:54, choice `h1:d0:1074:shop_choice:00` selected **No Brand** from two shop options: 2.7 min versus 4.4 min walking. Its saved English reason was:

> Back from work and prefers a quick nearby stop

This is the model’s explanation under the scenario, not evidence that a real person has that preference. Muse selects the bounded options; code checks the returned key and computes the resulting paths, times and costs. Work/school schedules and background residents retain rules. The browser worker saves accepted choices for identical replay. Provider outages stop the live request rather than silently claiming model success; guard fallback records retain their labels.

The report **passed on attempt 1**. Its 100% coverage is the verifier’s coverage of supported checks, not field accuracy; unsupported items are excluded. Numeric claims are recomputed from the run, and a separate Muse call judges cited evidence. No controlled rejection test or different household’s result is included in the main story.

## Separate four-person extension

> We are a family of four: two working parents and two elementary-school children. We work near Pangyo Station. Buying an apartment under 900 million won. Savings: 300 million won. Annual salaries: 60 million won and 60 million won. Minimum size: 74 sqm.

Run `cmvzm6kczd730` retains two adults and two children. In the saved scenario **A is Oryun Heights; B is Byucksan**. There are 44 and 132 live Muse choices respectively, no guard fallback, and the report passed on its first attempt. This record is never substituted for the couple’s.

School routes currently use nearby school POIs. **School-level and catchment matching are not supported.** This elementary-school example routes to secondary-school POIs; the video labels it as a proxy and does not claim enrollment or school suitability.

## Meta roles and editing

Spark 1.3 handled the main month’s consultation, household choices, diary/report writing and judging. Spark Open is a selectable product capability; the header switch is shown without claiming it produced this record. Muse Voice is input transcription; presentation narration was synthesized separately. Muse Code authored the product implementation and tests.

Model waits and scene playback are edited for pacing. All main result shots, numerical comparisons and cited decisions use `cmvzm1bok85ad`. Main end card points to the live entry and repository, not the earlier replay. The US context remains a presentation appendix.

## Validation

Implementation commit: `b07eaa53f91206a370a8f6e45cc9fcbd78ddf863`.

- Full JavaScript suite: 3,468 passed, 0 failed, 3 skipped (3,471 total).
- New live-choice bridge coverage: 20 focused tests pass, including chosen-option effects, exact replay, regional routes, worker timeout/error paths, API guards and quotas.
- Four-person extraction: 7 focused cases pass.
- Production build succeeds; existing chunk-size warning remains.
- Slow playback follow-up: 48 simulation/timeline tests pass. This only changes viewing speed, not saved simulation records.

The local video package includes the two full saved records, sanitized transcripts, evidence manifest, English script, captions and final QA report. The public release/YouTube upload and hosted deployment are separate publication steps.
