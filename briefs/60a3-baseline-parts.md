# Stage 60a3 — split the engine commute into walk, ride and wait (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Edit only `web/scripts/baseline-commute.mjs` and `web/tests/baseline-commute-60a.test.js`. Stop when done.

## Why
The real run is done:
- Korea: n = 12, `diff_min` mean 1.0.
- US: n = 5, `diff_min` mean 28.7.

The report has to say **where** the US gap comes from, so each row needs the engine's one-way minutes split into walk, ride and wait. The split must use exactly the C01 definition.

## Read once
`web/src/verify/numbers.js:157-198`:
- `waitAwayMinutes`;
- `AM_END_MINUTES`;
- `commuteOneWayMinutes`, which gives one member's one-way minutes = (walk + ride + wait) ÷ the number of commute halves;
- `engineValue("C01")` at `:210-219`, which averages that over `householdMembers(run)`.

Do not change `web/src/**`.

## Change (only `web/scripts/baseline-commute.mjs`)
1. **Export `commuteParts(run)`.** It returns `{ walk, ride, wait }`, each the household average per one-way half, rounded to 0.1, or `null` when C01 would be `null`.
   - For each member in `householdMembers(run)` (import it from `../src/verify/numbers.js`), count the halves **exactly** as `commuteOneWayMinutes` does:
     - commute trips and `ride` aways;
     - `day` plus am/pm split at 720.
   - Take `walk`, `ride` and `wait` from `run.totals.per_member[member]`:
     - `commute_walk_minutes`;
     - `commute_ride_minutes`;
     - `commute_wait_minutes`.
   - If any of the three is not finite, that member is skipped.
   - Divide each by the halves, then average over the members that were kept.
2. **In `main()`**, next to `engineValues.push(...)` (`:269`), also push `commuteParts(hit.run)` (or `null`) into `engineParts`. Pass `engineParts` to `buildRow`.
3. **`buildRow`** adds `engine_walk_min`, `engine_ride_min` and `engine_wait_min` to the row:
   - each is the mean over the seeds with non-null parts, rounded to 0.1;
   - each is `null` when there are none.

   Keep every existing field and its value as it is.
4. **`summarizeDiffs`** adds `parts_mean: { walk, ride, wait }`:
   - the mean of each new field over the counted rows, rounded to 0.1;
   - `null` for a part when none is finite.

## Test — add to `web/tests/baseline-commute-60a.test.js` (keep every existing test)
Use a fixture run with:
- 2 members in `run.agents` (or whatever `householdMembers` reads; check `numbers.js:52`);
- for each member: 2 commute trips on day 0 (one am, one pm) and 2 on day 1 (am, pm), so 4 halves;
- `totals.per_member` with walk 20, ride 40, wait 8 for member 1 and walk 12, ride 40, wait 4 for member 2.

Expected:
- `commuteParts` gives `{ walk: 4, ride: 10, wait: 1.5 }`;
- `walk + ride + wait` equals `oneWayCommuteOfRun(run)`.

Also check that `buildRow` with two seeds' parts averages them, and that `summarizeDiffs` returns `parts_mean`.

Run only: `cd web && node --test tests/baseline-commute-60a.test.js 2>&1 | tail -15`. Do not run the CLI.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Final message
Changed files, one line each.
