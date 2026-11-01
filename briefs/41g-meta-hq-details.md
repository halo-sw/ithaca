# Stage 41g — Meta HQ scenario details (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Runs after 41f. Do not edit `web/src/i18n/*` (the orchestrator adds English rows).

## Why
The orchestrator ran the Meta HQ scenario ("I work at Meta HQ in Menlo Park. Two of us, rent up to $4,500 a month.") on the production build, desktop and 390 px, Korean and English, plus the recorded replay `?replay=menlo-month`. It works end to end, but these details are off:

1. **Picked homes missing from the map.** In the replay, A (10 Coleman Place) and B (Apartments on South Perimeter Road) sit inside the cluster bubble "Belle Haven · 5 homes"; the map shows no A or B pin of its own, only pin "3 · 12 min to work". Picked homes must always have their own A/B pin next to the others, never only inside a cluster list.
2. **Wrong source chip on US turns.** After the first reply, later Muse replies in the same US chat show "Sources checked: MOLIT Real Transaction Price Disclosure System" (`web/src/ui/agent-float.js`, `isUsToolContext` only looks at the current turn's tool args). When the active profile/scenario is US (currency USD / region-us), every turn cites the US sources (`US_CITATIONS`), never MOLIT.
3. **Korean landing sends an English prompt.** The Korean button "Meta 본사 출근으로 해 보기" uses `META_HQ_EXAMPLE` (English), so the Korean screen gets English answers. In Korean, send "멘로파크 Meta 본사로 출근해요. 두 명이고, 월세는 4,500달러 이하예요." (keep the English prompt for the English landing). Check `profileFromText` parses the Korean sentence to the same profile (Meta HQ, 2 people, rent ≤ $4,500/mo); add the pattern if not.
4. **Pin minutes vs. 30-day result.** Candidate 1 (777 Hamilton) pin says "5 min" (bike), the card says "Walk 15 min · bike 5 min", the 30-day result says "One-way commute 14 min" (the household walked). The pin and the card headline must show the minutes of the mode the 30-day run uses for that home; the other mode stays as the second item on the card.
5. **3D label cut at the edge.** In the 3D view (Menlo, Day 1 08:10 · B), the partner's person label renders as "tner" at the left edge. Person and place labels are clamped inside the viewport (or hidden when their anchor is off screen), never cut.
6. **Capital letter mid-sentence.** Report sentence "You averaged 13.9 minutes and Your partner averaged 13.9 minutes one-way." The second member label is lower-cased when it is not at the start of the sentence ("your partner").
7. **Missing files requested on US runs.** Every US run requests `data/region-us/congestion.json` and `scenarios/decisions/from-profile-B-meta.json` (404). Do not request congestion for regions that have none (read the region manifest), and do not request a decision file that the run did not write; no 404 on a normal US run.
8. **Diary and report check on Muse Spark Open.** With `provider:"baseten"` the steps after the 30-day run fail at random: run 1 ended with "Couldn't write the diary this time" (one 500 from `/api/consult` on the 390 px run), run 2 wrote the diary but the report ended with "Couldn't verify the report (connection trouble)." and a Check again button. No error body reached the browser, so treat it as slow answers (Spark Open spends 4–5k reasoning tokens per call) hitting a timeout. Also in run 2 the diary summary starts with a stray "Muse " ("Muse A 777 Hamilton: …"). Make the diary and the report-check paths tolerate Spark Open: the same omission path as the agent (`reasoning_effort` / `json_schema`), a token budget that leaves room for the answer after reasoning, and one retry; if it still fails, fall back to the rule diary built from the same facts (not an empty diary).

## Tests — new `web/tests/meta-hq-details-41g.test.js`
- Cluster with picked A and B → A and B pins rendered outside the cluster (unit on the pin-building function).
- `isUsToolContext` / chip builder with a US session and a tool call with no USD args → US sources.
- Korean Meta HQ sentence → same profile fields as the English one.
- US candidate with walk 15 / bike 5 and a run mode of walk → pin minutes 15.
- Label clamp helper: an anchor at x = −20 gives a label fully inside or hidden.
- Report text join: second member label lower-cased.
- Diary with a mocked provider that returns empty content twice → rule diary lines, not an empty list.
- Report check with a mocked provider that times out once → retried once and passes; the client timeout for `provider:"baseten"` is longer than for meta.
- Diary summary never starts with "Muse ".

Run only the new file plus the tests for the files you touch, `| tail -15`.

## Final message
Changed files, one line each, plus any old pins changed (old → new).
