# Stage 41j — US pin minutes follow the 30-day run's mode (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Touch only the files named here and tests.

## Why
41g/41h added `runCommuteModeOf(run)` (`web/src/chatmap.js`) and stamping `runMode` onto picked US candidates in `web/src/ui/chat.jsx`. On a production run (Meta HQ, 777 Hamilton A + 1221 Willow Road B) the result says "One-way commute 14 min / 17 min" and the report says "walked home in 13.9 minutes", but after the run the A and B map pins still read "5 min" (the bike figure from "Walk 15 min · bike 5 min"). The stamp does not reach the pins.

## Change
Trace where the pin minutes come from after a run (pin builder in `chatmap.js` / the candidates passed to the map in `chat.jsx`) and make the picked homes' pins and card headline use `commuteMinutesOf(c, c.runMode)` once a run exists. Find why the stamp is lost (stale candidates object, the map reading a different list, or `runCommuteModeOf` returning null for this run shape) and fix the cause. Before any run, behavior is unchanged.

## Tests
Add to `web/tests/meta-hq-details-41g.test.js`: with a run whose home A trips are walking (use the real run shape: build it the way `chat.jsx` does, or a fixture copied from an existing run test), the pins for A and B show the walk minutes (15), not 5. Run that file plus the chatmap tests, then the full suite once: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head`.

## Final message
Cause in one sentence, changed files one line each, suite line.
