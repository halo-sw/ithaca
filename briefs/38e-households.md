# Stage 38e — work-from-home, three-generation and dog-owning households: read from the customer's words, run, and verified (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass. A parallel run (38f) is editing `web/src/engine/**`; do not touch it.

## Why
The user wants real employees to use this, not only couples and families with a child.
- Today `persona_map` in `scenarios/verify/ground_truth.json` maps `remote_worker`, `multigen_family` and `pet_owner` to `null`. `verifyReport` (`web/src/verify/loop.js:28-40`) then answers `미지원`.
- `findMembers` (`web/src/profile.js:234-264`) only knows adults and a child.
- Nothing reads "재택", "부모님 모시고" or "강아지".

**Engine fields 38f adds** (write them; do not implement them). All optional; the defaults change nothing:
- `cafe_visits_per_week` (0..5, café trips on days not in `workdays`; purpose `cafe`);
- `home_office` (bool, no commute);
- `dog_walk_morning` (bool, a morning walk to the park; purpose `park`);
- `vet_visits_per_month` (0..4; purpose `vet`).

The engine already has: role `"senior"` (walks at `slow_mps`), any `workdays` subset, `park_walks_per_week` (0..7) and `clinic_visits_per_month`.

## Change
1. **Profile cues** (`web/src/profile.js`). Pure finders, Korean first, then English, word-bounded. Evidence must be verbatim slices (`guardProfileValues` checks this).
   - **Seniors**, in `findMembers` (`:234-264`):
     - `부모님`, `양가 부모님`, `시부모님`, `장인어른·장모님` → 2 members `{ role: "senior", relation: "부모" }`;
     - `어머니`, `엄마`, `아버지`, `아빠`, `장모님`, `시어머니`, `할머니`, `할아버지`, `어르신` → 1 each (dedupe repeated words);
     - only when the text also says they live together: `모시고`, `같이 살`, `함께 살`, `모셔`, `with my parents`, `live with`, `my mother lives with`. A sentence like "부모님 댁 근처" adds nobody.
     - English: `my parents` → 2; `my mother|mom|father|dad|grandma|grandpa|mother-in-law|father-in-law` → 1, with the same "live with" condition.
     - Seniors are appended after the adults/child; with no adult cue, add one adult first.
     - `RELATION_LABEL` (`:920-923`) already maps `부모` → `부모`. Give seniors the label `부모님` (one senior: `어머니`/`아버지` when that word was used, else `어르신`).
   - **Office days**, new field `officeDays`:
     - `주 N일 출근`, `주N회 출근`, `일주일에 N번 출근`, `N days a week in the office`, `in office N days`, `hybrid N days` → N (1..4).
     - `재택`, `재택근무`, `풀재택`, `완전 재택`, `work from home`, `fully remote`, `WFH`, `remote` with no N → 0.
     - N = 5 or no cue → field stays null (today's behaviour).
   - **Pets**, new field `pets` = `{ kind: "dog"|"cat"|"pet", count }`:
     - `강아지`, `반려견`, `개를 키`, `댕댕이` → dog;
     - `고양이`, `반려묘`, `냥이` → cat;
     - `반려동물` → pet;
     - English `dog|puppy` → dog, `cat|kitten` → cat, `pet` → pet;
     - `두 마리` / `2 dogs` → count 2, else 1.
   - Wire both into `extract_profile` (`:574-…`, next to `membersHit` at `:683`) and `emptyProfile`. Keep the same `{ value, source, evidence, note }` shape.
2. **Scenario mapping** (`scenarioFromProfile`, member loop `:1050-1080`):
   - **Senior:** `role: "senior"`, `work: { type: "none" }`, `workdays: []`, `park_walks_per_week: 7`, `clinic_visits_per_month: 2`, `errands_per_week: { supermarket: 1, convenience: 2 }`. Never a commute.
   - **`officeDays` N (1..4)**, for every commuting adult: `workdays` = N=1 `["Wed"]`, N=2 `["Tue","Thu"]`, N=3 `["Mon","Wed","Fri"]`, N=4 `["Mon","Tue","Thu","Fri"]`, plus `cafe_visits_per_week: min(2, 5 − N)`.
   - **`officeDays` 0:** `home_office: true`, `work: { type: "none" }`, `cafe_visits_per_week: 2`. `runGate` (`:826-848`) treats this like `noCommute` (no workplace needed).
   - **`pets.kind === "dog"`:** the first adult gets `dog_walk_morning: true`, `park_walks_per_week: 7`, `vet_visits_per_month: 1`. Cat or pet: `vet_visits_per_month: 1` only.
   - Seniors and children never get `cafe_*` or dog fields.
3. **Persona** (`web/src/verify/compare.js:14-30` `personaFor`). Precedence stays child > remote > senior > pet. Remote now also fires when `officeDays` is 0..4 (not only `noCommute`). `pets` reads the new field shape.
4. **Ground truth** (`scenarios/verify/ground_truth.json`).
   - `persona_map`: `remote_worker` → `scenarios/personas/remote-worker.json`, `multigen_family` → `scenarios/personas/multigen-family.json`, `pet_owner` → `scenarios/personas/pet-owner.json`.
   - Write those three runnable templates. Copy the shape of `scenarios/personas/newlywed-couple.json`, and keep its `_note` convention that inputs are 가정값 placeholders:
     - **remote:** 1 adult, officeDays 2, Pangyo;
     - **multigen:** 2 adults + 2 seniors;
     - **pet:** 2 adults + a dog.
   - **Items:**

     | Item | `engine` | `verify` | Other fields |
     |---|---|---|---|
     | R04 카페·코워킹 접근성 | `supported` | `deterministic` | `data_field: "poi.cafe_walk_minutes"`, `rule: "report value within ±2 min"`, `engine_source: "cafe trips (purpose=cafe)"` |
     | M02 병원 접근성 | `supported` | (as is) | (as is) |
     | M05 어르신 낮 시간 활동 | `partial` | `deterministic` | `data_field: "poi.park_walk_minutes"`, `engine_source: "senior park walks (purpose=park); 경로당 not modelled"` |
     | P02 산책로·공원 거리 | (as is) | (as is) | `engine_source` adds `morning dog walk` |
     | P04 동물병원 접근성 | `supported` | `deterministic` | `data_field: "poi.vet_walk_minutes"`, `engine_source: "vet trips (purpose=vet)"` |

   - Every other R/M/P item stays `none`. P01 (pets allowed) stays `none`; never claim a listing policy.
5. **Deterministic numbers** (`web/src/verify/numbers.js:29-36`):
   - `MINUTE_TOLERANCE` adds `R04: 2, M05: 2, P04: 3`;
   - `ITEM_PURPOSE` adds `R04: "cafe", M05: "park", P04: "vet"`;
   - extend the header comment.
   - A run with no trips of that purpose yields `null`, so `inapplicableItems` marks the item instead of failing it. Check that this already holds.
6. **Labels.** `PERSONA_KO` (`web/src/ui/chat.jsx:720-721`) stays. Add the persona labels the report shows, if any pure table lists persona → Korean label outside `ui/`: `remote_worker` `재택근무`, `multigen_family` `삼대 가족`, `pet_owner` `반려견 가구`. `ground_truth` `pet_owner.label_ko` is already `반려견 가구`.

## Tests — new `web/tests/households-38e.test.js`
- **Seniors:** `extract_profile("맞벌이 부부인데 부모님 모시고 살아요. 판교로 출근해요", null, { stations: ["판교"] })` → members roles `["adult","adult","senior","senior"]`. `"부모님 댁 근처로 이사 가고 싶어요"` adds no senior.
- **English seniors:** `"My wife and I live with my mother. We work in Gangnam."` → roles `["adult","adult","senior"]`.
- **officeDays:** `"주 2일 출근하는 1인 가구예요. 판교로 출근"` → `officeDays` 2. `"풀재택이에요"` → 0. `"I work from home"` → 0. `"주 5일 출근"` → null.
- **Pets:** `"강아지 한 마리 키워요"` → `{kind:"dog",count:1}`. `"고양이 두 마리"` → `{kind:"cat",count:2}`. `"We have a dog"` → dog.
- **Evidence:** `guardProfileValues` passes for all of the above.
- **`scenarioFromProfile`** (reuse the minimal homes fixture other profile tests use):
  - officeDays 2 → the adult's `workdays` is `["Tue","Thu"]` and `cafe_visits_per_week` 2;
  - a senior member has `role: "senior"`, `work.type` `none`, `park_walks_per_week` 7, `clinic_visits_per_month` 2;
  - a dog → the first adult has `dog_walk_morning: true` and `vet_visits_per_month` 1;
  - officeDays 0 → `home_office: true`, and `runGate` is ok without a workplace.
- **`personaFor`:** officeDays 2 → `remote_worker`; two seniors and no child → `multigen_family`; a dog → `pet_owner`; a child plus a dog → `young_family`.
- **Ground truth:** `persona_map` has no `null`, the three template files exist and parse, and each has `household.members`.
- **`verifyReport`** for `pet_owner` with a run that has `park` and `vet` trips no longer returns `미지원`.
- **Keep green:** web tests matching `extract_profile|scenarioFromProfile|personaFor|verifyReport|ground_truth|persona_map|runGate`.

Run only:
```
cd web && node --test tests/households-38e.test.js $(grep -lE "extract_profile|scenarioFromProfile|personaFor|verifyReport|ground_truth|persona_map|runGate" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/**` (the orchestrator adds English rows), `web/src/main.js`, `web/src/consult/server.js`, `web/src/data-fetch.js`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
