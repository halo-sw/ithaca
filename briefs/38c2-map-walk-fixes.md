# Stage 38c2 — map walk: subway legs drawn from the real ride detail, plain-Korean activity line, whole day in view, controls not clipped; the household chip shows the dog, parents and office days (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (live run, localhost, 1440×810)
Run: a two-income couple with a dog, both working in Pangyo, buying for ₩700M or less. I opened the moment "B 5일차 08:10 8호선 남한산성입구→모란" and switched to `지도`. Capture: the map shows only the 1 km around home B.
1. **No subway leg.** `dayTimeline` (`web/src/mapwalk.js:143-185`) reads ride stations with `splitStations(a.detail)`, as if `detail` were a string. The engine's ride away `detail` is an object (`web/src/engine/routines.js:544-548`):
   - `{ direction, ride_minutes, ride: { from, to, legs: [{ line, lineName, stops: [<station names>], stopIds, distanceKm }] } | null, ride_fallback, dest_walk }` (legs from `findPath`, `web/src/engine/journey.js:177-186`).
   - So every ride is skipped (`if (!pts.length) continue`), and the fit only covers the walk.
2. **Raw purpose in the activity line.** The line read `08:00 · 걷는 중 · errand까지`. Walk segments take `label: t.purpose || t.to` (`:131-137`), but `t.to` is an object `{ kind, id, label }`.
3. **A black work square on the home.** `web/src/ui/mapwalk.jsx:250-260` draws every `stay` segment as the black 12 px square, including home stays and the first stay of the day.
4. **The day buttons are clipped at the right edge.** `‹ 5일차 ›`: the `›` is cut at 1440 px. Phone not checked yet.
5. **The household chip ignores the new fields.** The top chip read `판교 출근 · 2인 · 매매 7억 원 이하`, with no dog. `profileSummary` (`web/src/chat/engine.js:516-537`) has no `pets`, `officeDays` or senior handling.

## Change
1. **Rides** (`mapwalk.js`).
   - For a `ride` away, use `a.detail.ride.legs`.
   - Each leg becomes one `ride` segment that splits the away's time in proportion to `leg.distanceKm`, with:
     - `pts` = the leg's `stops` mapped through `stationCoord` (unknown names dropped; fewer than 2 points → skip that leg);
     - `label` = `${lineName} ${stops[0]}→${stops[stops.length-1]}`;
     - `line` = `leg.line`, so the colour comes from the network line id (`lineColorFor({ id: leg.line })`, not a label search).
   - With `detail.ride` null and `detail.ride_fallback` present, draw a single straight segment between its from/to stations if both resolve; else skip.
   - Remove `splitStations` if unused.
2. **Walk labels.** `label` = `t.to && t.to.label` (string).
   - When the next segment is a ride, the walk reads `<first station>역까지` (do not add `역` if the name already ends in `역`).
   - Purpose fallback table, used only when there is no label: `commute` 출근길, `errand` 장보기, `park` 산책, `clinic` 병원, `cafe` 카페, `vet` 동물병원, `school` 등굣길. English: commute, errand, walk, clinic, café, vet, school.
   - Never show a raw purpose key.
3. **Stays.**
   - Draw the work square only for an away of kind `work`.
   - Other stays get a small grey dot, and nothing at all when they sit on the home point (the home pin already marks it).
   - The `activityLine` for a stay uses the away label (`판교 직장`, `<park> 산책`, `<cafe> 작업`, `<vet> 진료`).
4. **Fit.**
   - The initial view fits every segment of the primary member for the day: walk + ride + the workplace walk on the other box.
   - Keep `fitMapView`'s margin.
   - Add a `전체`/`Fit` button that refits to the whole day. Also add a toggle `따라가기`/`Follow` (default off) that keeps the moving dot centred at the current zoom.
5. **Controls row** (`mapwalk.jsx`). One flex row that wraps: play button, slider (`flex: 1 1 160px; min-width: 120px`), day nav.
   - Nothing may overflow the panel at 1440 px or at 390 px.
   - The activity line wraps on its own row; text ≥ 14px; no `text-overflow`.
6. **Chip** (`profileSummary`). After the member count, add:
   - `반려견 1` / `반려묘 2` / `반려동물` from `pets`;
   - `부모님 2` when seniors are present (count of `role: "senior"`), and keep `N인` counting everyone;
   - `주 N일 출근`, or `재택` for officeDays 0.
   - Same `·` joining.

## Tests — extend `web/tests/mapwalk-38c.test.js` (and the profileSummary test file if one exists)
- **A ride away** with `detail.ride.legs = [{ line: "line8", lineName: "8호선", stops: ["남한산성입구","단대오거리","신흥","수진","모란"], distanceKm: 3 }, { line: "bundang", lineName: "수인·분당선", stops: ["모란","야탑","이매"], distanceKm: 2 }]` over 08:10–08:20:
  - two ride segments, 08:10–08:16 and 08:16–08:20;
  - the first has 5 points and `line: "line8"`;
  - the first label is `8호선 남한산성입구→모란`.
- **A walk trip** with `to: { label: "남한산성입구" }`, followed by that ride, reads `08:05 · 걷는 중 · 남한산성입구역까지`. A walk with no label and purpose `errand` reads `… · 장보기까지`. No output contains `errand`, `commute` or `[object`.
- **SSR:** the work square (`width="12"` rect) renders only for a `work` stay.
- **profileSummary:**
  - `{ members: [adult, adult], pets: {kind:"dog",count:1}, workplaces: [판교], tenure: trade, priceMax: 7e8 }` → `판교 출근 · 2인 · 반려견 1 · 매매 7억 원 이하`;
  - with two seniors added → `4인 · 부모님 2`;
  - officeDays 2 → contains `주 2일 출근`.
- **Keep green:** web tests matching `mapwalk|profileSummary|SceneFrame`.

Run only:
```
cd web && node --test tests/mapwalk-38c.test.js $(grep -lE "mapwalk|profileSummary|SceneFrame" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`data/`, `pipeline/**`, `web/src/engine/**`, `web/src/i18n/**`, `web/src/main.js`, `web/src/consult/**`, `README*`, `web/public/recorded/**`.

## Final message
Changed files, one line each. Nothing else.
