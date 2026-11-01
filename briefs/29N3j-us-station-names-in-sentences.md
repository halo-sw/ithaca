# Stage 29N3j — US station names in sentences read like the map: 팔로알토역 / Palo Alto Stn (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why (public site, Korean UI, US run 124 University Avenue vs 515 Cleveland Street)
The "살아 봐야 아는 것" line reads `해 진 뒤 걸어서 퇴근: A 44번 · Palo Alto역에서 평균 4분(340m) · B 44번 · Redwood City Transit Center역에서 평균 10분(770m) · 해 지는 시각 17:00 기준`, while the map (29N3i) says 팔로알토역. The line is built in `web/src/engine/life-events.js:~300-340` from the station place name in the run (raw OSM names: `Palo Alto`, `Redwood City Transit Center`, `San Carlos`, `Belmont`, `Mountain View`, `2nd & King`/`Caltrain` in SF …). English has the same raw names (`from Redwood City Transit Center Station`, `web/src/i18n/en.js:~554-558`).

## Change
1. One helper next to `usStationKoName` in `web/src/region-names.js`, e.g. `usStationDisplay(name, lang)`: normalise a raw US station name to its Caltrain station — strip ` Caltrain Station`, ` Caltrain`, ` Station`, ` Transit Center`, a leading `Downtown `, trailing platform/lane words — then match the US area labels (`Palo Alto`, `Redwood City`, …; SF `4th & King`/`2nd & King`/`Caltrain` → `San Francisco`). Korean → `팔로알토` (caller appends `역` as today), English → `Palo Alto` (the English template already appends ` Station`; keep that or use `Stn` consistently with the map plates — pick what the template does). Unknown names pass through unchanged; Korean station names are never touched.
2. Use it wherever a US run's station name is printed in a sentence: the after-dark line in `life-events.js`, other life-event / moment lines that name a station (grep `역에서`, `역 `, `station` in `web/src/engine/life-events.js`, `web/src/engine/moments.js`, `web/src/verify/`), and the 29N3h English diary digest if it names stations. The map plates and 3D pill (29N3i) should call the same helper so all surfaces agree.

## Tests — new `web/tests/us-station-names-29N3j.test.js`
- `usStationDisplay("Redwood City Transit Center","ko") === "레드우드시티"`, `("Palo Alto","ko") === "팔로알토"`, `("Downtown Mountain View Transit Center","en") === "Mountain View"`, `("2nd & King","ko") === "샌프란시스코"`, a Korean name `("선릉","ko") === "선릉"`.
- The after-dark line builder on a fixture with A at `Palo Alto` and B at `Redwood City Transit Center` gives `팔로알토역에서` and `레드우드시티역에서` in Korean, and English `from Redwood City Station` (no `Transit Center`).
- A Korean-run fixture line is byte-identical to before.
Keep green: `tests/us-ko-screen-29N3i.test.js`, `tests/us-30d-polish-29N3d.test.js`, `$(grep -l "life-events\|해 진 뒤" tests/*.test.js)`; list any expectation you updated.

Run only:
```
cd web && node --test tests/us-station-names-29N3j.test.js tests/us-ko-screen-29N3i.test.js tests/us-30d-polish-29N3d.test.js $(grep -l "life-events\|해 진 뒤" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each, plus updated expectations. Nothing else.
