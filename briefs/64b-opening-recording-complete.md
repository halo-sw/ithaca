# 64b — Mark the recorded opening complete

Documentation only. Halo supplied the new opening in the November 4 04:04 movie. It has been inserted into the final local edit at 8.77–35.67 seconds. Actual total is 177.2333 seconds. Update ONLY docs/demo-script.md with the exact document below. The changed narration and offsets are transcribed from the original voice and edit timeline. Same run, results, live calls and images; no generated voice, product change or media upload. README video link stays unchanged.

No additional reading is needed. Do not run tests/builds/git, explore the repo, or spawn subagents. Write the one document, then stop.

BEGIN EXACT DOCUMENT
# Presenter-led demo script

[Back to README](../README.md)

**Current local final edit: November 4, 2026 · 2:57.2 · English · Halo’s own recorded face and voice.** This video has not been uploaded to GitHub or YouTube. The README still links the older published v9 video and its separate run.

## Opening updated from Halo’s November 4, 04:04 recording

The 0:00–0:08.77 introduction and build provenance remain unchanged. The Korean problem statement now occupies 0:08.77–0:35.67. The supplied recording replaced the prior problem narration; only the lead-in, excess pauses and self-corrections were trimmed. Halo’s speech remains at its original speed, with no generated or cloned voice.

> I'm looking for our first home in South Korea. However, deposit-fraud news made renting feel really risky, while rising prices made buying feel urgent. Even without fraud, a home can consume our savings and still not fit our daily lives. So I built Ithaca to simulate 30 days in two homes before we decide.

Keep the same chronological product recording beneath the presenter. Do not add a fraud-statistics slide or substitute a different household. Deposit fraud motivates the founder’s concern; the purchase demo shows household fit, costs and commutes. It does not demonstrate fraud prevention or a safe lease.

The repository’s [problem definition](../README.md#3-problem-definition) supplies the founder context. The separate [`jeonse_check` tool](../web/src/consult/tools-money.js) and [deposit-check UI](../web/src/ui/jeonse.jsx) show transaction-derived deposit-to-price ratios, available building information, missing data and an official-source checklist. These are warning signals, not a safety verdict, and that separate feature is not shown in this purchase recording. [MOLIT’s victim-support announcement](https://m.korea.kr/news/policyNewsView.do?newsId=148943905) establishes the deposit-fraud context; no current victim count is asserted in this narration.

## Current edit: one household, one recorded month

The principal run is **`cmw0ygvgsa8c3`**, an illustrative Pangyo couple, using Muse Spark 1.3. The input, reviewed plan, month, results, report checks and 3D inspection come from this same saved run. Waiting is accelerated while Halo’s voice stays at normal speed. Both genuine plan-service errors remain in the accelerated footage; the successful revised plan receives more screen time. There is no persistent recording-speed banner.

The supplied opening card reads **Built with Muse Code** and **Using Muse Spark**, alongside the event identity, Ithaca logo and “Built solo from scratch since October 28.” The current ending retains the live-app and repository addresses. These are the user-requested brief title and ending treatments.

The diary illustration at 2:38.2 is a continuation: the same saved diary was reopened in a new capture and a new live Muse Image 1.0 call succeeded. It did not rerun the month. A brief on-screen note distinguishes the continuation. Neither Spark Open nor SAM is claimed to have run in this video.

## Narration in the current local edit

The times below describe the local 2:57.2 edit with the new opening. Result figures and the run record are unchanged.

### 00:00.0–00:08.8 · Founder and build provenance

> I'm Halo, a solo developer in South Korea. I built Ithaca from scratch, starting October 28, for Meta Hackathon 2026.

### 00:08.8–00:35.7 · Korean problem and personal motivation

> I'm looking for our first home in South Korea. However, deposit-fraud news made renting feel really risky, while rising prices made buying feel urgent. Even without fraud, a home can consume our savings and still not fit our daily lives. So I built Ithaca to simulate 30 days in two homes before we decide.

### 00:35.7–00:55.4 · One household and two candidates

> Let's follow an example couple working in Pangyo, South Korea. I enter their budget, schedules and preferences. Muse searches Korean public transaction records. I choose two homes to compare. These prices are historical references. They don't mean the homes are currently available.

### 00:55.4–01:14.8 · Review and revise the plan

> Muse proposes a plan for each person, including errands and walks. One commutes every weekday; the other works from home twice a week. I check the working days, remote days and assumptions, then confirm the same 30-day window for both homes. This may take a few minutes, so I'm speeding up the wait.

### 01:14.8–01:31.8 · Thirty days and a real Muse decision

> Thirty days covers about four weekly cycles, showing how routines add up. Muse uses each person's preferences, recent choices and available options to make daily decisions. Code calculates routes, time and costs.

### 01:31.8–01:50.2 · Actual costs, commutes and assumptions

> Home A takes 4.8 minutes to work, versus 23.9 for Home B. It costs about ₩514,000 less per month, under these assumptions. I can trace the sources and assumptions behind each calculation.

### 01:50.2–02:05.6 · First-pass report check

> Code compares numerical claims with engine values. A separate Muse call checks cited events. The timeline shows what passed or needs attention. That checks consistency with this simulated run.

### 02:05.6–02:15.0 · First week versus full month

> We can compare the first week with the full month. The planner also supports family and mixed routines, while keeping unsupported needs visible.

### 02:15.0–02:38.2 · Decision record and matching 3D journey

> We can inspect the alternatives and follow the resulting journey in 3D. That connects a preference to its consequences. Muse Spark powers the planning and choices. Muse Code built the product. Now we know what to check at the viewing. Try your household with Ithaca.

### 02:38.2–02:50.7 · Diary and Muse Image continuation

> Muse Spark writes the diary from this run. Muse Image illustrates one recorded moment, not a photo of the actual home, but an actual diary of the simulation results.

### 02:50.7–02:57.2 · Ending

> Before you sign, live the next 30 days.

## Exact evidence used by this edit

| Metric | Home A | Home B |
|---|---:|---:|
| Average one-way commute | 4.8 min | 23.9 min |
| Estimated monthly housing + recorded commute | ₩509,790 | ₩1,023,917 |
| Historical transaction area band | 25–35 m² | 55–65 m² |
| Muse choices / rule fallbacks | 70 / 0 | 64 / 1 |

Home A’s estimated monthly total is **₩514,127 lower** under the reviewed assumptions. Halo says **about ₩514,000**; exact values remain visible. No unstated USD exchange rate is used. Both workplaces are assumed near Pangyo Station; the loan rate is 4%, term 30 years, and maintenance ₩150,000/month. These are simulation inputs, not a validated prediction or a recommendation to buy Home A.

The report passed on the first attempt. That is consistency with this run, not field accuracy. There are **134 model-sourced choices and 1 labelled rule fallback**. The older v9 run `cmw0nibca873f` has 133 and 2; it is not substituted for this recording. [Presenter-run evidence](evidence/recording-presenter.json) · [Older v9 evidence](recording-v9.md).

The actual call shown offers the partner a park walk (5.1 min) or staying home (0 min) on a remote workday. Muse chooses the park with the recorded reason **“Fits evening walk routine on remote workday.”** Code computes time and distance. The saved call identifies `muse-spark-1.3`, its allowed options, choice, reason and source. The browser sends requests through Ithaca’s relay; it does not hold a hosted Meta service key.

The diary illustration comes from the recorded commute activity (07:51, Korea). It is labelled **Illustration by Muse Image · not a photo of the real place**. It is not a measured or photographic depiction of the candidate home.

## Delivery and publication

- The supplied opening has been incorporated; all narration uses Halo’s original recordings.
- Validate spoken timing, captions, exact recorded results and the 2:57.2 duration before delivery.
- Supply the final local MP4 for Halo to upload to YouTube. **Do not upload the video to GitHub.**
- Keep the existing published v9 link until the actual new YouTube URL is supplied. Then verify playback and update the video link without mixing the two run records.

END EXACT DOCUMENT
