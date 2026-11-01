# Stage 29N3i — US homes on the Korean screen: no fake "walk direct 11 min", Korean-only sort note, `$3,541` in Korean report lines, Korean station names on the map (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only what you grep. Stop when the named tests pass.

## Why (public site, Korean UI, "메타 본사(멘로파크 1 Hacker Way)로 출근해요. 둘이 살고 월세는 4,500달러까지예요.")
1. Card `124 University Avenue` (Palo Alto) shows `또는 도보 직행 약 11분(추정, 30일 살아 보기에는 없음)`; Redwood City `약 20분`, San Carlos `약 13분`. Walking from Palo Alto to Meta HQ is ~80 min (`commute.walk_direct_min 79.5`). Cause: `pipeline/homes_us.py` writes `work_targets["meta-hq"]` for station-box homes by snapping HQ to the nearest node **of the box graph** (HQ is outside the box), e.g. `walk_m 876, walk_minutes 11.2, bike_minutes 3.5`; the 29N3b `alt` line takes `work.minutes`/`work.mode` from that.
2. The sort note reads `정렬: 동네마다 한 곳씩(가까운 동네부터) · one home per area (closest area first)` — both languages at once (29N3c).
3. Korean report lines say `ZIP 평균 월세(Zillow), 관리비 없음으로 3,541$였어요` — USD written as `3,541$`.
4. Map station plates read `Palo Alto역`, `San Carlos역`, `Belmont역` on the Korean screen; `web/src/region-names.js` already has Korean names (팔로알토, 샌카를로스, 벨몬트, 레드우드시티, 마운틴뷰, 서니베일, 샌프란시스코).

## Changes
1. **Pipeline** (`pipeline/homes_us.py`): write `work_targets["meta-hq"]` only when HQ snaps to the area's own graph within the existing anchor limit (the `us-menlo` case); station-box homes get no `meta-hq` work target (their commute block already carries `bike_direct_min` / `walk_direct_min` estimates and the Caltrain route).
2. **Alt line** (`web/src/homes.js` `usCommuteBest`, `web/src/ui/candidate-card.jsx`): for station-box homes `alt` comes only from `commute.bike_direct_min` / `commute.walk_direct_min` (the smaller, with its mode), never from `work_targets`; show it only when smaller than the Caltrain total. Old data that still has a box `work_targets.meta-hq` must not leak into `alt`.
3. **Sort note**: one language per screen (Korean `동네마다 한 곳씩(가까운 동네부터)`, English `one home per area (closest area first)`); grep where 29N3c joins them.
4. **USD in Korean lines**: grep the report/verify line that builds `관리비 없음으로 …였어요` (and any other `…$` Korean money text) and format USD as `$3,541` (`월 $3,541` where a month is meant), using the existing USD formatter.
5. **Korean station names**: on the Korean screen, US station plates and the 3D station pill use the Korean name from `region-names.js` + `역` (`팔로알토역`); English keeps `Palo Alto Stn`.

## Tests — new `web/tests/us-ko-screen-29N3i.test.js`
- `usCommuteBest` for a Palo Alto fixture that carries a bogus `work_targets.meta-hq {walk_minutes: 11.2}` plus `commute.bike_direct_min 24.8`, `walk_direct_min 79.5`, total 37 → headline caltrain 37, `alt` = bike 24.8 (never walk 11.2); Korean card line `또는 자전거 직행 약 25분(추정, 30일 살아 보기에는 없음)`.
- Sort note for US `areas` in Korean has no ASCII words; in English no Hangul.
- The Korean rent line for USD 3541 contains `$3,541` and not `3,541$`.
- Korean station plate for `Palo Alto` is `팔로알토역`; English `Palo Alto Stn`.
Python, add to `tests/test_homes_us.py`: a station-box fixture whose HQ lies outside the box graph gets no `meta-hq` work target; the `us-menlo` fixture keeps it.
Keep green: `tests/us-measured-first-29N3b.test.js`, `tests/us-areas-29N3c.test.js`, `tests/us-caltrain-30d-29N3.test.js`, `tests/us-30d-polish-29N3d.test.js`, `tests/map-us-six-29N2c.test.js`; list any expectation you updated.

Run only:
```
.venv/bin/pytest -q tests/test_homes_us.py 2>&1 | tail -2
cd web && node --test tests/us-ko-screen-29N3i.test.js tests/us-measured-first-29N3b.test.js tests/us-areas-29N3c.test.js tests/us-caltrain-30d-29N3.test.js tests/us-30d-polish-29N3d.test.js tests/map-us-six-29N2c.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `data/`, `relay/`, `briefs/`. Final message: changed files, one line each, plus updated expectations. Nothing else.
