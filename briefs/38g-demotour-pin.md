# Stage 38g — demo tour: re-pin the recorded profile-search names to the 38a/38b build (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 2 tool calls. Stop when the named test passes.

## Why
The orchestrator rebuilt `data/build` with 16 lines and 186 boxes (38a/38b). The real `find_homes` result for the recorded demo question changed, and the orchestrator already rewrote the recorded answer in `web/src/ui/demotour.js:104-114` from a real run. The test pin is stale.

## Change — `web/tests/demotour.test.js:167-170` only
Replace the expected names with:
```
"백궁 동양파라곤", "수서현대벤쳐빌", "(84-0)", "다누림빌", "신우아트빌", "서울숲 더샵",
```
`total_matching` stays 2698. Then add one assertion after the names: every candidate name appears in `rec.a` (the recorded answer), so the transcript and the pin cannot drift apart again.

Run only:
```
cd web && node --test tests/demotour.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
Everything except `web/tests/demotour.test.js`.

## Final message
Changed files, one line each. Nothing else.
