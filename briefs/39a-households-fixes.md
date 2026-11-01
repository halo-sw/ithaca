# Stage 39a — households found broken in the end-to-end test: parents' run fails, the second workplace is lost, English office days and DMC are missed, and a walk is shown as the whole commute (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (local Pages copy + local relay, real model)
1. **The 30-day run fails for a household with parents.** The message was "맞벌이 부부인데 부모님 모시고 같이 살아요. 남편은 광화문, 저는 강남역으로 출근해요. …", and the run card showed `scenario: household.members[2] needs a non-empty weekday list`.
   - Cause: `web/src/profile.js:1196-1203` sets `out.workdays = []` for seniors.
   - `parseScenario` rejects an empty list (`web/src/engine/scenario.js:31`).
   - The 38e test never passed the scenario through `parseScenario`.
2. **Only one workplace is read.** The chip read `강남 출근 · 4인 · 부모님 2`, and 광화문 was dropped.
   - `findWorkplace` (`profile.js:454-…`) returns the first match.
   - `extract_profile` writes a single `{ member: 0, … }` (`profile.js:880-888`).
3. **English office days are missed.** "I live alone and go to the office in Digital Media City 3 days a week, otherwise I work from home." read as `work from home` (officeDays 0).
   - `findOfficeDays` (`profile.js:333-351`) knows only "N days a week in the office", so the remote words win.
4. **The English workplace is missed in the same sentence.** The chip asked "Commute where?".
   - The English `tail` lookahead (`profile.js:~493`) does not allow a following number ("Digital Media City 3 days").
   - The alias table (`profile.js:421-430`) has no "Digital Media City".
5. **A walk is shown as the whole commute.** With no workplace, the card row read `총 1분 · 강남구청역 걸어서` ("Within total 1 min · … on foot"). `commuteRow` (`web/src/ui/candidate-card.jsx:214-217`) labels a station walk as the total.

## Change
1. **Seniors** (`profile.js:1198`): delete `out.workdays = [];`. Seniors keep the default weekday list with `work: { type: "none" }`, which already means no commute.
2. **Two workplaces** (`profile.js`). Add a pure `findWorkplaces(text, stations)` that returns a list of `{ member, text, evidence, resolved }`.
   - Split on `,` `.` `그리고` `고 `.
   - In each clause, a person word followed by a mention gives that member's workplace when the mention resolves to a station (`resolveWorkplace`) or the clause has a work verb:
     - `저는|나는|제가|전` → member 0;
     - `남편은|남편이|아내는|아내가|와이프는|신랑은|배우자는` → member 1;
     - English `I work|I commute|I go to the office` → 0; `my wife|my husband|my partner` → 1.
   - A shared verb at the end of the sentence ("…광화문, 저는 강남역으로 출근해요") covers the earlier clauses.
   - When no person words appear, fall back to today's single `findWorkplace` result as member 0.
   - `extract_profile` writes the whole list, with evidence joined by ` · `. `scenarioFromProfile` already reads `workplaces[i] || workplaces[0]`.
   - The chip (`profileSummary`, `web/src/chat/engine.js`) shows `광화문·강남 출근` when there are two different stations.
3. **Office days**, in `findOfficeDays`. A dated match always beats the remote words. Add:
   - `/(\d|one|two|three|four)\s*days?\s*(?:a|per)\s*week/i`, when the text also has `office|commute|go in|work in`;
   - Korean `주\s*(\d)\s*일`, when the text has `출근`;
   - `일주일에\s*(한|두|세|네)\s*번\s*출근`.
   - Map word numbers 1–4.
4. **English workplace**:
   - add `\d` and `on` to the `tail` alternation, so `office in Digital Media City 3 days` gives the mention `Digital Media City`;
   - add aliases `"Digital Media City": "디지털미디어시티"` and `"DMC Station": "디지털미디어시티"`.
5. **Card row** (`candidate-card.jsx:214-217`): when the ride is unknown, return `${station}역까지 걸어서 ${near} · 지하철 시간은 출근지를 알면 계산해요`, with `estimate: false` and `source: "official"`. Do the same in `commuteShortLine` (`:102-104`), whose `· 승차 미확인` already says it. Never use `총` without a ride.

## Tests — new `web/tests/households-39a.test.js`
- **Parents.** `scenarioFromProfile` for `extract_profile("맞벌이 부부인데 부모님 모시고 같이 살아요. 남편은 광화문, 저는 강남역으로 출근해요.", null, { stations: ["광화문","강남"] })`, with the minimal homes fixture the 38e test uses, passes `parseScenario` without throwing. Seniors have `work.type` `none` and a non-empty `workdays`.
- **Two workplaces.** The same text gives `workplaces` member 0 → 강남 and member 1 → 광화문. In the scenario, m1's workplace station is 강남 and m2's is 광화문. `guardProfileValues` passes.
- **Office days.** `officeDays` is 3 for the English sentence above, 3 for "주 3일 출근하고 나머지는 재택이에요", 2 for "일주일에 두 번 출근해요", and still 0 for "풀재택이에요".
- **English workplace.** The English sentence resolves the workplace to `디지털미디어시티`.
- **Card.** A candidate with `walk.known` and no ride gives a `commuteRow` text that contains `역까지 걸어서` and not `총`.
- **Keep green:** web tests matching `extract_profile|scenarioFromProfile|commuteRow|commuteShortLine|profileSummary|households`.

Run only:
```
cd web && node --test tests/households-39a.test.js $(grep -lE "extract_profile|scenarioFromProfile|commuteRow|commuteShortLine|profileSummary|households" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/**` (the orchestrator adds English rows), `web/src/main.js`, `web/src/consult/**`, `README*`.

## Final message
Changed files, one line each. Nothing else.
