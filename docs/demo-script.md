# Presenter-led demo script

[Back to README](../README.md)

**Recording draft · target 2:55 · English.** The published README video is still v9. This script does not establish that a new continuous session has been recorded or submitted. Fill every bracketed result from the new session before recording the corresponding narration.

## Story

A short viewing can lead to a long housing commitment. Ithaca lets a household review routines, simulate repeated choices, inspect computed consequences and prepare better questions for a real viewing. The intended benefit is fewer surprises; it has not been measured in a field study.

## One continuous session

Start on the actual app, with a small circular presenter. Display **Meta Hackathon 2026** and **Built from scratch since Oct 28, 2026** in the opening overlay. No separate title or architecture slides interrupt the product. The timestamps below divide the narration, not the recording into disconnected demos.

Keep one source recording from the initial input through the final inspection. Speed up waiting without deleting intervals or substituting another run. Preserve visible retries, unsupported items and fallbacks. Keep the face and narration at normal speed on separate tracks. During waiting show:

```text
This may take a few minutes.
Recording sped up · [actual speed]×
```

The browser calls Ithaca’s relay. Show a sanitized decision response or the saved decision record when explaining a model call. Do not describe the browser as directly calling Meta, and never expose credentials. A saved response is labeled as recorded evidence, not a newly executing call.

## Narration and actions

### 00:00–00:35 · Problem, founder and purpose

**On screen:** Start on the actual app landing page. Small circular presenter throughout. Show “META HACKATHON 2026 · Solo build · Built from scratch since Oct 28, 2026” as a brief opening overlay. Begin entering the household during the second half of the problem statement.

> In Korea, first-time buyers can spend a day viewing homes—and still feel rushed to sign. I’m Halo. I built Ithaca from scratch, solo, starting October twenty-eighth, for Meta Hackathon twenty twenty-six. Listings show prices and floor plans. But they don’t show how both partners’ commutes, remote days, and errands fit together. A poor fit costs time and money every day. Ithaca lets a household simulate thirty days in each home before deciding.

### 00:35–00:48 · One household and two candidates

**On screen:** Use the example prompt, find candidates and select two homes. Keep the same recording running.

> Here’s an example couple working in Pangyo. I enter their budget and routines, then choose two homes from Korean transaction records. These are historical prices, not available listings.

### 00:48–01:05 · Show the agent revising a plan

**On screen:** Show the original office-week plan, click Adjust my routine, enter the actual correction, wait for Muse, and inspect the revised home-office days. Do not run the month until confirming the revised plan.

> Muse proposes a plan for each person. Now I change one condition: my partner works from home Tuesdays and Thursdays. Muse revises the plan. I review the change and confirm.

### 01:05–01:26 · Why 30 days and how choices work

**On screen:** Show real run progress. Keep “This may take a few minutes.” and the actual recording speed visible during waiting. Do not conceal errors or fallback labels.

> This may take a few minutes, so I’m speeding up the wait. Thirty days repeats workdays, remote days, weekends and errands. Muse uses preferences and recent choices to select among available options. Code computes routes, time and cost.

### 01:26–01:36 · An actual model call

**On screen:** Show the actual decision request/response or saved decision from THIS session, with model/provider, options, chosen_key, reason and chosen_by. A saved response is labeled as recorded. Never show keys or authorization headers.

> Here’s a recorded Muse call from this session: its model, allowed options, chosen action and reason. Each decision keeps its source.

### 01:36–01:52 · The resulting trade-off

**On screen:** Read exact source values from this run; show both original monthly totals in the UI. Use about for any rounded spoken value. Do not import the previous v9 numbers.

> Home A takes about [A_MIN] minutes to work; Home B, [B_MIN]. Their estimated monthly housing and commute costs differ by [MONTHLY_GAP] won. These figures use the assumptions we reviewed.

### 01:52–02:06 · A choice becomes a journey

**On screen:** Open a real model-sourced decision from this run and its matching journey. Keep the natural app navigation in the continuous recording.

> Muse chose [ACTUAL_CHOICE] because [ACTUAL_REASON]. I can inspect the alternatives and follow that journey in 3D. The preference, choice and consequence stay connected.

### 02:06–02:24 · How the report is checked

**On screen:** Open source/calculation detail and the report timeline from this same run. Preserve actual first-pass, retry or unverified status; never manufacture FAIL → PASS.

> Open the calculation to see sources and assumptions. Code compares numerical claims with engine values. A separate Muse call checks cited events. This timeline shows the actual result, including anything that remains unverified.

### 02:24–02:37 · What the month adds; broader households

**On screen:** Open First 7 days and Full period. Mention family capability without inserting another household’s results or creating a second run.

> We can compare the first week with the full month. Families and mixed routines use the same planning process; missing school routes and other unsupported needs stay visible.

### 02:37–02:46 · Runtime and development roles

**On screen:** Return to the same recorded 3D journey. If using a label, show “Muse Code · development” only here. No model-list slide or implied browser-side Meta API secret.

> The relay calls Muse; the browser runs the simulation. Muse Code built the product during development. The household makes the final decision.

### 02:46–02:55 · Conclusion and intended benefit

**On screen:** Keep the product journey visible under the presenter and final links: halo-sw.github.io/ithaca and github.com/halo-sw/ithaca. No full-screen roadmap card.

> The goal is fewer surprises and clearer trade-offs before moving in. Try Ithaca with your household. Before you sign, live the next thirty days.

## Set up the real plan revision

Use an explicitly illustrative household. The first plan has both adults commuting Monday to Friday. Then actually change the partner to Tuesday/Thursday remote work through **Adjust my routine**, and check the revised plan before confirming. This is a real change of user preference, not a deliberately induced model error.

Initial input:

> We are an example couple buying our first home, up to 700 million won, with 200 million won saved. Our annual salaries are 50 and 45 million won. We both work near Pangyo Station; use the station as our explicit workplace assumption. We both commute Monday to Friday. I prefer quick grocery stops. My partner enjoys evening park walks. Each of us makes one supermarket trip and one convenience-store trip, plus two park walks per week. Accept the default departure times and work duration as simulation assumptions. Minimum size 25 square meters, commute under 60 minutes. Find homes to compare.

After choosing two homes and generating the initial plan, use Adjust my routine and enter:

> Change only my partner’s schedule: work from home on Tuesday and Thursday, and commute on Monday, Wednesday and Friday. Keep everything else the same.

Inspect the actual model revision. If questions remain, resolve them in this session. Do not confirm an incorrect plan to fit the script. Revision latency is part of the continuous recording and can be sped up.

## Fields to fill from the new run

| Field | Source |
|---|---|
| A_MIN / B_MIN | Actual final average one-way commutes for the two selected homes |
| MONTHLY_GAP | Absolute difference between monthly housing + recorded commute totals, under the same assumptions |
| ACTUAL_CHOICE / ACTUAL_REASON | A saved model-sourced decision and the reason in that same record |

Keep exact totals visible even when spoken figures are rounded. A previous published run or a synthetic test cannot fill these fields. If there is no valid model-sourced example, show the actual state and revise the narration.

For the call scene, inspect the decision request’s allowed options and response’s model/provider, chosen_key, reason and chosen_by. Redact credentials before any export. Do not fabricate a terminal log or a response that contains fields the real call did not return.

SAM photo analysis, Muse Image illustrations, Voice input and Spark Open are documented product capabilities. Only claim they executed in this video if this session actually uses them. The main three-minute story prioritizes the reviewed plan, a real revision, a real Muse decision and the computed comparison.

## Before replacing the published video

- Match all results, decisions and verification outcomes to one new recorded run.
- Check the completed edit stays at or below 2:58, with audible narration and synchronized captions.
- Reuse the presenter’s new opening if it matches the final script; rerecord the changed body and unresolved result passages as needed.
- Upload the actual final file, verify signed-out playback, and then replace the README and submission links together.
- Until that file exists and is checked, keep the working published v9 link and its own evidence intact.
