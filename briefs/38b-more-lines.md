# Stage 38b — lines 1, 4, 6, Gyeongui-Jungang, AREX, Ui-Sinseol and Sillim join the network, so Seoul Station, Yongsan and Sangam resolve as workplaces (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build, no pipeline runs on `data/`. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass. Another Muse run is editing `pipeline/boxes.py`, `pipeline/areas.py`, `pipeline/cli.py`, `pipeline/homes.py` and `web/src/consult/**`; do not touch those.

## Found by the orchestrator
- **The network has 9 lines and 291 stops.** `LINE_SPECS` (`pipeline/network.py:52-73`): 2, 3, 5, 7, 8, 9, 신분당, 수인·분당, 경강.
- **So these workplaces resolve to nothing:** "서울역으로 출근", "용산에서 일해", "상암 DMC 출근". `resolveWorkplace` (`web/src/profile.js:315-322`) only matches network station names exactly.
- **OSM relation names** in `data/raw/south-korea-latest.osm.pbf`, scanned by the orchestrator:
  - **Line 1:** `수도권 전철 1호선: 광운대 → 신창` and 94 more patterns, plus `수도권 전철 1호선 경인·경원 계통: 의정부 → 인천` and `…급행`/`…특급` patterns. Other cities' `인천 도시철도 1호선`, `광주 도시철도 1호선` and `대전 …` must not match.
  - **Line 4:** `수도권 전철 4호선: 진접 → 오이도` … (`부산 도시철도 4호선` must not match).
  - **Line 6:** `서울 지하철 6호선: 신내 → 응암순환`, `응암순환 → 신내`, `봉화산 → 응암순환`, `응암순환 → 봉화산`. The 응암 loop is one-way at the end; it is not `circle`.
  - **Gyeongui-Jungang:** `경의·중앙선: 문산 → 용문` …; skip `경의·중앙선 셔틀: …`.
  - **AREX:** `인천국제공항철도 일반열차: 서울역 → 인천공항2터미널` and back; skip `인천국제공항철도 직통열차` (non-stop) and `인천국제공항 셔틀트레인`.
  - **Ui-Sinseol:** `우이신설선: 북한산우이 → 신설동` and back (`route=light_rail`).
  - **Sillim:** `서울 경전철 신림선: 관악산 → 샛강` and back (`route=light_rail`).
- **Run minutes.** The Seoul Metro table (`web/src/transit/schedule.js`, OA-12034) already covers lines 1–8. Lines 1, 4 and 6 get timetable minutes wherever the table has the pair. The other new lines use the existing distance estimate; nothing new is needed there.

## Change
1. **`pipeline/network.py` `LINE_SPECS` + `MATCH_ORDER`.** Add:

   | id | name | match |
   |---|---|---|
   | `line1` | `1호선` | `수도권 전철 1호선` |
   | `line4` | `4호선` | `수도권 전철 4호선` |
   | `line6` | `6호선` | `서울 지하철 6호선`, `수도권 전철 6호선` |
   | `gyeongui` | `경의·중앙선` | `경의·중앙선`, `경의중앙선` |
   | `arex` | `공항철도` | `인천국제공항철도 일반열차`, `공항철도` |
   | `uisinseol` | `우이신설선` | `우이신설선` |
   | `sillim` | `신림선` | `신림선` |

   - None are `circle`.
   - `SKIP_PATTERN_WORDS` adds `특급`, `직통`, `셔틀`. Keep `급행`.
   - Matching is still substring-based; keep it prefix-safe so the other cities' `… 1호선` / `… 4호선` never match. Anchor `line1`/`line4` on the `수도권 전철` prefix.
2. **Transfers.** Whatever builds `transfers` from shared station names covers the new lines automatically. If the transfer list is a hand-written table, add 서울역, 용산, 공덕, 디지털미디어시티, 왕십리, 청량리, 신설동, 동대문역사문화공원, 삼각지, 이촌, 홍대입구, 김포공항, 대림, 샛강, 신도림, 노량진, 동묘앞, 창동, 사당, 충무로, 금정, 회기.
3. **App colours** (`web/src/chatmap.js:63-75` `LINE_COLORS`). Add the official colours:
   - `line1: "#0052A4"`, `line4: "#00A5DE"`, `line6: "#CD7C2F"`, `gyeongui: "#77C4A3"`;
   - `arex: "#0090D2"`, `uisinseol: "#B0CE18"`, `sillim: "#6789CA"`.
4. **Workplace aliases** (`web/src/profile.js:309-322`).
   - Before the exact match, map a small alias table:
     - `상암`, `상암DMC`, `상암동`, `DMC` → `디지털미디어시티`;
     - `서울역` → the network's Seoul Station name, whatever `normStationWord` makes of the OSM stop (check `서울역` → `서울`).
   - Keep the rule "exact match only, never a guess".
   - English (`resolveEnglishStation`, `:396-411`): strip a trailing ` station` / ` stn` from the mention before comparing, so `Seoul Station` resolves to Seoul Station. Also accept `Sangam`/`DMC` via the same alias table.
5. **Fares.** If the fare code has a per-line extra-fare table (신분당선 is separate), leave the new lines on the integrated distance fare, with no extra. AREX 일반열차 is in the integrated fare.

## Tests
**New `tests/test_network_38b.py`:**
- The line-matching function (the one that maps a relation name to a line id) maps:
  - `수도권 전철 1호선: 광운대 → 신창` → `line1`;
  - `수도권 전철 1호선 경인·경원 계통: 의정부 → 인천` → `line1`;
  - `인천 도시철도 1호선: 검단호수공원 → 송도달빛축제공원` → None;
  - `부산 도시철도 4호선 (미남방향)` → None;
  - `서울 지하철 6호선: 신내 → 응암순환` → `line6`;
  - `경의·중앙선: 문산 → 용문` → `gyeongui`;
  - `인천국제공항철도 일반열차: 서울역 → 인천공항2터미널` → `arex`;
  - `우이신설선: 북한산우이 → 신설동` → `uisinseol`;
  - `서울 경전철 신림선: 관악산 → 샛강` → `sillim`;
  - `신분당선: 신사 → 광교` → `sinbundang` (unchanged);
  - `수인·분당선: 청량리 → 고색` → `bundang` (unchanged).
- Skip words: `수도권 전철 1호선: 동인천 → 용산 특급`, `인천국제공항철도 직통열차: …` and `경의·중앙선 셔틀: 도라산 → 임진강` are skipped.

**New `web/tests/lines-38b.test.js`:**
- `LINE_COLORS` has the 7 new ids with the hex values above.
- `extract_profile` (or the exported profile function the existing tests use):
  - `서울역으로 출근하는 1인 가구예요` with stations `["서울역", "판교"]` resolves the workplace to the Seoul Station name;
  - `상암 DMC로 출근해요` with `["디지털미디어시티"]` → `디지털미디어시티`;
  - `I work near Seoul Station` (English path) resolves too.
- **Keep green:** web tests matching `LINE_COLORS|resolveWorkplace|findWorkplace|workplace` and `tests/test_network*.py`.

Run only:
```
.venv/bin/pytest -q tests/test_network_38b.py $(ls tests/test_network*.py 2>/dev/null | tr '\n' ' ') 2>&1 | tail -15
cd web && node --test tests/lines-38b.test.js $(grep -lE "LINE_COLORS|findWorkplace|workplace" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `web/src/i18n/**` (the orchestrator adds English line and station names), `web/src/ui/**`, `web/src/main.js`, `web/src/consult/**`, `pipeline/boxes.py`, `pipeline/areas.py`, `pipeline/cli.py`, `pipeline/homes.py`, `pipeline/regions.py`, `README*`, `scenarios/`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
