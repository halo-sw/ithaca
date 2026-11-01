# Stage 38f — the life engine learns three household habits: a café on work-from-home days, a morning dog walk, a vet visit (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass. Two other Muse runs are editing `web/src/profile.js`, `web/src/verify/**`, `scenarios/**`, `web/src/main.js`, `web/src/ui/**` and `web/src/consult/server.js`; do not touch those.

## Why
The user wants work-from-home, three-generation and dog-owning households to run for real. Those three personas are still `null` in `scenarios/verify/ground_truth.json` `persona_map`.
- The engine already covers part of it:
  - seniors walk at `slow_mps` (`web/src/engine/agents.js:18-25`);
  - `workdays` can be any subset;
  - `park_walks_per_week` (0..7) and `clinic_visits_per_month` exist (`web/src/engine/scenario.js:264-303`, `web/src/engine/routines.js:801-844`).
- What is missing: a place to work on remote days, a morning dog walk and a vet trip. A parallel brief (38e) maps the customer's words to the member fields below and turns the personas on.
- POIs in the built boxes, counted over 60 boxes: `amenity:cafe` 626, `amenity:library` 87, `amenity:veterinary` 62.

## Interface (fixed; 38e writes these fields)
Member fields, all optional; the defaults keep every current run byte-identical:
- `cafe_visits_per_week`: integer 0..5, default 0. Only on days that are not in `workdays`, Mon–Fri, for an adult with a job (`work.type !== "none"`) or `home_office: true`.
- `home_office`: boolean, default false. The member works from home that day; no commute.
- `dog_walk_morning`: boolean, default false. A short morning walk every day.
- `vet_visits_per_month`: integer 0..4, default 0.

New trip purposes and away kinds: `cafe` (away label `<place> 작업`) and `vet` (away label `<place> 진료`, kind `vet`). The morning dog walk uses purpose `park` and away kind `park` with label `<park> 강아지 산책`, so the existing park checks (P02, F03) count it.

## Change
1. **`web/src/engine/places.js:14-60` `buildPlaces`.** Add:
   - `cafes`: categories `amenity:cafe`, `amenity:library`, `office:coworking`, `amenity:coworking_space`;
   - `vets`: `amenity:veterinary`.
   - Same anchoring rule (`MAX_ANCHOR_M`) as the other lists. Export the category sets like `CLINIC_CATS`.
2. **`web/src/engine/scenario.js:255-305`.** Normalise and validate the four fields with the ranges above. Same `fail(...)` style.
3. **`web/src/engine/routines.js`.**
   - **Schedule.** Where `clinicDays` / `parkDays` are derived per agent (find it once with `grep -n "clinicDays\|parkDays" web/src/engine/routines.js`), add:
     - `cafeDays`: the first `cafe_visits_per_week` non-workdays among Mon–Fri, in Mon→Fri order;
     - `vetDays`: spread like `clinicDays`, from the per-run deterministic stream the clinic uses.
   - **Morning dog walk.** When `dog_walk_morning`, every day before any commute:
     - walk to the nearest park round trip (`nearestRoundTrip(router, agent.home_node, places.parks, 1)`), dwell `F.dog_walk_dwell_min`, then home;
     - start at `F.dog_walk_start_min`, so a commute that departs earlier pushes the walk earlier, never overlapping (mirror how the commute departure is computed);
     - no park → `unavailable("park", "park")` once per day, like the evening branch.
   - **Café block** on `cafeDays` for a member who is not commuting that day. Mid-morning (`F.cafe_start_min`): nearest `places.cafes` round trip, dwell `F.cafe_dwell_min`, purpose `cafe`, away kind `cafe`.
     - Cause: `고객 입력: 재택 날 주 N회 카페 작업`, criteria ids `["C-cafe-freq", "C-cafe-dwell", "C-walk-speed", "C-walk-route"]`.
   - **Vet** on `vetDays`, after the clinic block, the same shape as the clinic block at `:801-815`.
     - Purpose `vet`, away kind `vet`, cause `고객 입력: 월 N회 동물병원`.
     - No vet → `unavailable("vet", "vet")`.
   - **`home_office` members** never get commute trips; days in `workdays` become home days, and the café rule above applies.
   - **Totals.** If the totals / per-member walk minutes count purposes in a fixed list, add `cafe` and `vet` to the non-commute walk minutes, alongside park/errand/clinic.
4. **Criteria.** Add rows next to `C-clinic-freq` / `C-clinic-dwell`, wherever those are defined (`grep -rn "C-clinic-dwell" web/src scenarios` once; edit only that file):
   - `C-cafe-freq`, `C-cafe-dwell` (default 120 min), `C-cafe-start` (600 = 10:00);
   - `C-dog-walk` with `dwell_min` 15 and `start_min` 420 (07:00);
   - `C-vet-freq`, `C-vet-dwell` (default 40 min).
   - All carry `source: "가정값"` (same field the other assumed defaults use).
   - Wire them into `F` the way `clinic_dwell_min` is.

## Tests — new `web/tests/engine-habits-38f.test.js`
Use the smallest existing engine fixture (the one `web/tests/*routines*` or `*simulate*` tests already load; reuse its loader, no new data files).
- **Byte-identical:** a run of that fixture with none of the new fields gives a byte-identical `JSON.stringify(run.trips)` to the same run before (compare against a run with the fields explicitly set to their defaults).
- **Café:** an adult with `workdays: ["Tue","Thu"]` and `cafe_visits_per_week: 2` over 7 days → exactly 2 `cafe` aways, on Mon and Wed. Every `cafe` trip's day is not Tue/Thu.
- **Dog:** `dog_walk_morning: true` → 7 morning `park` aways labelled `… 강아지 산책` over 7 days, each ending before that day's first commute trip departs.
- **Vet:** `vet_visits_per_month: 1` over 30 days → exactly 1 `vet` away, or 1 `unavailable` entry with kind `vet` when the fixture has no vet.
- **Home office:** `home_office: true` + `cafe_visits_per_week: 5` → 0 commute trips and 5 `cafe` aways per Mon–Fri week.
- **Validation:** `cafe_visits_per_week: 6` and `vet_visits_per_month: -1` both fail validation.
- **Keep green:** web tests matching `simulate|routines|planAgent|buildPlaces|scenario\.js|validateScenario`.

Run only:
```
cd web && node --test tests/engine-habits-38f.test.js $(grep -lE "simulate\(|planAgent|buildPlaces|validateScenario|routines" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/i18n/**`, `web/src/profile.js`, `web/src/verify/**`, `scenarios/verify/**`, `scenarios/personas/**`, `web/src/ui/**`, `web/src/main.js`, `web/src/consult/**`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
