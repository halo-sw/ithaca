# Stage 42l — update one test for the re-recorded menlo-month (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` or `web/public/recorded/*`.

The orchestrator re-recorded `web/public/recorded/menlo-month.json` today with a live Muse Spark 1.3 session (777 Hamilton 14 min vs 124 University Avenue 33 min). Its candidates come from the current search code, so they carry `best_min` (777 Hamilton: `best_min` 4.6 = bike, `commute.work.minutes` 14.7 = walk). `web/tests/pin-minutes-29g3.test.js` → `first recorded US candidate with commute.work matches its work.minutes` now fails (`4.6 !== 14.7`) because `commuteMinutesOf` (`web/src/chatmap.js:329`) prefers `best_min` before `work.minutes` (by design since that test was written).

Change only the test: the recorded-candidate check asserts what `commuteMinutesOf` is meant to return for a recorded candidate today — `best_min` when present, else `work.minutes` — and keeps a separate assertion that with `runMode` `"walk"` it returns `work.walk_minutes` (14.7). Do not change `chatmap.js`.

Also scan `web/tests/` for any other test that reads `public/recorded/menlo-month.json` and pins old content (e.g. `10 Coleman Place`, `us-home-0027`, `12 minutes`, `totals were equal`) and update it to the new recording's facts, read from the file rather than hard-coded where possible.

Run the touched files, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`.

## Final message
Changed files one line each, suite line.

## Retry (42l2)
The first attempt rewrote `web/tests/pin-minutes-29g3.test.js` from scratch and dropped six unrelated tests (the `29g3 first loading line speaks the page language` suite and the two synthetic `commuteMinutesOf` tests). The file has been restored. This time edit **only** the body of `it("first recorded US candidate with commute.work matches its work.minutes", …)` (rename the title to match the new assertion if you like) and, inside the same `describe`, add one `it` for the `runMode` `"walk"` case. Every other line of the file stays exactly as it is; the file must still contain all its original `it(` blocks (6 before, 7 after).
