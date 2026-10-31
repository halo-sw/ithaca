# Stage 36e — the demo couple buys what they can afford: 올림픽카운티 (잠실 side) vs 분당 엠코 헤리츠 (미금), officetel purchase costs (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 36c2 is in the tree (uncommitted, do not touch its files). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer (2026-11-01): the demo couple (연봉 6천 + 5천, 모은 돈 2억) does not fit 레이크팰리스. They want reasonably priced homes, compared as neighbourhood → workplace (`잠실 → 판교 / 미금 → 판교`), and buying, not 전세.

The orchestrator searched `data/build/homes/*.json`. Near 정자·미금·판교 there is **no apartment** ≥ 45 ㎡ under 7억 with ≥ 3 deals; only officetels. The new pair compares two homes of the same size and a similar price: a farther apartment and a near officetel.

| | A | B |
|---|---|---|
| home | `home-014844` 올림픽카운티, 아파트, 2003 | `home-000183` 분당 엠코 헤리츠, 오피스텔, 2014 |
| address (RTMS) | 서울 송파구 방이동 51-4 | 경기 성남시 분당구 구미동 9-1 |
| box | `st-송파나루` (complex `효성올림픽카운티` in `area.json`) | `st-미금` (no complex entry; resolve by lon/lat `127.1082913, 37.3493344`) |
| 전용 (RTMS) | 56.22 ㎡ | 61.18 ㎡ |
| trade, 60 ㎡ bucket | 5 deals, median 6.25억 | 5 deals, median 5.87억 |
| walk to station | 송파나루 6.4 min (graph) | 미금 1.7 min (graph) |
| ride to 판교 | 32.2 min: 9호선 → 8호선 → 수인·분당선 → 경강선, transfers 석촌·복정·이매 (3 × 4 min included) | 6.6 min, 신분당선 미금 → 정자 → 판교 |
| ride basis | `commuteSummary` + `rideMinutes`: only the 8호선 leg is from the timetable; the rest is km × 1.43 min/km | km × 1.43 min/km |

## Change
0. **Leftover from 36d2** (`web/tests/education.test.js:186`). For 판교 백현마을 705동 the nearest elementary school is 13.4 graph-minutes away. Keep `school_elementary >= 1` for 잠실. For 판교, assert it in the 15-minute band (or whichever band `educationCounts` offers that contains 13.4). Do not change the code.
1. **Officetel purchase costs** (`web/src/money/purchase.js`; callers in `money/tenure.js` and wherever `purchaseCosts(` is called — find them with `grep -rn "purchaseCosts(" web/src web/scripts`). An officetel is not a 주택 for 취득세. Add a `kind` argument (`"아파트" | "오피스텔" | …`, default today's housing rules). For `오피스텔`:
   - 취득세 4% flat. Basis `지방세법 제11조 제1항 제7호 나목`.
   - 지방교육세 0.4% (`지방세법 제151조 제1항 제1호`: (4% − 2%) × 20%).
   - 농어촌특별세 0.2% (`농어촌특별세법 제5조 제1항 제6호`: 2% 세율 기준 취득세액의 10%). No 85 ㎡ exemption: that applies to housing only.
   - 중개보수 상한 0.5% (`공인중개사법 시행규칙 제20조 제4항`, 전용 85 ㎡ 이하 with kitchen and bathroom). Above 85 ㎡ use 0.9% and the note `협의 (상한 0.9%)`.
   - A note line: `오피스텔은 주택이 아니라서 취득세가 4%예요 (주택은 1~3%).`
   - Pass the home's `kind` from every caller that knows it: candidate cards (homes index `kind`), the money script (scenario `money.kind`), and the chat tools. Unknown kind keeps today's housing rules.
2. **Scenario** (`scenarios/demo-two-homes.json`):
   - **Homes.**
     - A `{label: "A", area: "st-송파나루", complex_name: "효성올림픽카운티"}`.
     - B `{label: "B", area: "st-미금", complex_name: "분당 엠코 헤리츠", lon: 127.1082913, lat: 37.3493344}`. If `resolveHome` fails because the complex is not in `area.complexes`, let it fall through to the lon/lat anchor when lon/lat are given. Test it.
   - **Work** (both members). Keep the place 판교역. Set:
     - `station_name {A: "송파나루", B: "미금"}`;
     - `destination_station {A: "판교", B: "판교"}`;
     - `ride_minutes {A: 32.2, B: 6.6}`;
     - `ride_minutes_source: "derived_estimate"`;
     - `needs_user_input: false`;
     - a `ride_minutes_note` with the basis lines from the table.
   - **Money.**
     - `tenure {A: "매매", B: "매매"}`;
     - `kind {A: "아파트", B: "오피스텔"}`;
     - `area_m2 {A: 56.22, B: 61.18}`.
     - Keep salaries 6,000만 / 5,000만 and cash 2억.
     - Update `_note`: placeholders, buying, sources.
   - **Note.** Update `_note`: no "customer input 30 min".
3. **`derived_estimate` source** (`web/src/evidence.js:66-71`, `engine/routines.js:382,543`, `nowcard.js:437`). Treat `derived_estimate` like the assumption for tags: subway part `가정값`, never `측정`. Its label where a source is shown: `추정 (노선 거리 × 평균 속도)`. `derived` stays `측정`.
4. **Demo copy** (`web/src/ui/demotour.js` and any caption that says 전세, 레이크팰리스, 백현마을, or `잠실 → 판교 30분`):
   - Speak of 매매.
   - Name 올림픽카운티 (송파나루 → 판교) and 분당 엠코 헤리츠 (미금 → 판교).
   - Keep the copy short. Korean only; the orchestrator adds English to `src/i18n/`.
   - `listings.jsx:28,118` examples: use 올림픽카운티 and a 매매 line in the same format.
   - `timeline.js:156` and `scene-chrome.js:68` comments: update the example names. Keep the `scene-chrome.js:74` entry and add `"올림픽카운티": "Olympic County"`, `"효성올림픽카운티": "Hyosung Olympic County"`, `"분당 엠코 헤리츠": "Bundang Emco Heritz"`.

## Test — new `web/tests/affordable-demo-36e.test.js`
- **Officetel costs:** `purchaseCosts({priceWon: 587000000, areaM2: 61.18, kind: "오피스텔"})` gives 취득세 23,480,000, 지방교육세 2,348,000, 농특세 1,174,000, and a 중개보수 cap of 2,935,000. Without `kind`, today's housing numbers are unchanged.
- **Scenario:** `loadScenario` parses the new file. `resolveHome` on the real boxes (skip when `data/build/st-미금/area.json` is missing):
  - A resolves to a 효성올림픽카운티 building with `dwelling_filter: true`;
  - B resolves by lon/lat to a node within 150 m.
- **Evidence:** with `ride_minutes_source: "derived_estimate"`, the subway part is `가정값`.
- **Copy:** `demotour` has no `전세`, `레이크팰리스` or `백현마을`.

Run only:
```
cd web && node --test tests/affordable-demo-36e.test.js tests/education.test.js tests/honest-parts-36d.test.js $(grep -lE "purchaseCosts|purchase\.js|demotour|scenario\.js|evidence" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
Tests that read `data/build/sim/*` will fail until the orchestrator regenerates the sim data. List them in the final message; do not edit them. If anything else still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**`, `src/aerial/**`, `src/journey-scene.js`, `src/main.js` (36c2), `pipeline/**`, `relay/**`, `data/`, `README*`, `public/recorded/**`.

## Final message
Changed files, one line each. The tests that wait for regenerated sim data. Nothing else.
