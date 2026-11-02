# Stage 42m — "규칙으로 답했어요" only on real rule answers, not on the app's own run-done line (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*` or `web/public/recorded/*`.

## Why
The re-recorded `menlo-month` replay (a live Muse Spark 1.3 session) ends with the app's own run-done line `Finished living there. A 777 Hamilton: average one-way commute 14 min; B 124 University Avenue: 33 min.` and under it `Answered by rules` (`규칙으로 답했어요`). That line is the app's status report after the run, not an answer to a question, and Muse was live the whole session — judges read it as "Muse wasn't used". The mark comes from 42b showing it for any assistant text with `fromModel: false` (the recorded message is `{ fromModel: false, model: "meta", id: "m13" }`).

## Change
- Show the rule mark only on messages explicitly created as a rule answer to the customer's turn: set a flag (e.g. `ruleAnswer: true`) where 42b/42d/42h/42i/42j push rule answers (after-run answers, digitless-Muse supplements, no-answer fallbacks, rule-path replies when Muse is unavailable), and render the mark from that flag only.
- App status lines (run started / run done / diary and report status / compare-add "세 집으로 살아 볼게요" when it is the app's action line) get no mark. Messages without the flag (all existing recordings) show no mark.
- Keep the 42b warning banner logic as is.

## Tests — new `web/tests/rule-mark-42m.test.js` (+ update 42b/42d/42h tests that relied on `fromModel: false` alone)
- A recorded run-done message `{ role: "assistant", kind: "text", fromModel: false }` renders without `규칙으로 답했어요` / `Answered by rules`.
- A rule answer created by the after-run path carries the flag and renders the mark.
- `web/public/recorded/menlo-month.json` and `seoul-couple.json`: no message renders the mark.
Run the new file + 42b/42d/42h/42i/42j tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`, and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.
