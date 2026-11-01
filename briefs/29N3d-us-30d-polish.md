# Stage 29N3d — US 30-day run polish: commute average includes the wait, Caltrain is not "subway", generic places read in English, no homes without a station walk (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only what you grep. Stop when the named tests pass.

## Why (live capture, English, Meta HQ search, A = 515 Cleveland Street Redwood City, B = 553 West El Camino Real San Carlos, "Live 30 days")
1. The result table says **One-way commute A 36 min · B 31 min**, but the cards say Caltrain 44 / 46 min and the moments say "commuted 44 min", "Longest commute day: 46 min". 44 − 36 = 8 and 46 − 31 = 15 are exactly the waits (half headway): the commute average skips the 29N3 `kind: "wait"` away. The wait is part of door to door.
2. The 3D view labels the station `San Carlos · subway entrance`, and the timeline legend/segments say `Subway` for the Caltrain ride.
3. The diary says `went to gongwon (공원) for 30 min` — an unnamed park's Korean generic label romanised. US area places carry no Korean names; the generic label comes from the engine/record side.
4. Card 2 `425-427 Alma Street` (Palo Alto) shows `Walking not confirmed | Can't …`: three US station-box homes have `commute.walk_to_station_min.value: null` (no station walk on the graph): Palo Alto `425-427 Alma Street`, Mountain View `Willow Park`, `eaves Mountain View at Middlefield`.

## Changes
1. **Commute metrics** (grep the one-way commute average / `commute_avg` / longest-commute metric in `web/src/engine/` and the result card): count `wait` aways inside the commute (between leaving home and arriving at work, and back), so the average and the longest day are door to door. Korean runs have no `wait` aways → numbers unchanged.
2. **Caltrain wording** (3D station label, timeline legend and segment titles, journey text): when the ride's line is `caltrain` (or the run's region is US), the station label is `<Name> Stn · Caltrain` / `<이름>역 · 칼트레인` (no "subway entrance"), and the legend/segment kind reads `Train` / `열차` for that run (Korean runs keep `Subway`/`지하철`). Grep `subway entrance`, `지하철 입구`, `Subway` in `web/src/ui/`, `web/src/scene*`, `web/src/i18n/en-table.js`.
3. **Generic place labels in English**: where a record names an unnamed POI by its Korean category (`공원`, `편의점`, `마트`, `병원`, …), English output (moments, diary record rows sent to Muse, 3D labels) uses the English generic (`a park`, `a convenience store`, `a supermarket`, `a clinic`) instead of romanising it; never `gongwon (공원)`. Find where the category label is set (grep `"공원"` in `web/src/engine/`) and where English romanises names (`romanizeName` / `data-no-i18n` paths) — fix at the label, not by string replacement in the diary.
4. **Pipeline**: `pipeline/homes_us.py` drops a station-box home whose station walk is unknown (count it in the area summary as `dropped_no_station_walk`), like homes without a ZIP rent are dropped today. `us-menlo` homes are unaffected.

## Tests
New `web/tests/us-30d-polish-29N3d.test.js`:
- A run fixture with a `wait` away of 8 min between the walk and the ride → one-way average and longest commute include it; a Korean fixture without `wait` gives the same numbers as before.
- The station label / legend helper returns `Palo Alto Stn · Caltrain` and `Train` for a Caltrain run, `… subway entrance`/`Subway` stays for Korean.
- English label for an unnamed park record is `a park` (no Hangul, no `gongwon`).
Python, add to `tests/test_homes_us.py`: a station-box fixture home with no station walk is dropped and counted.
Keep green: `tests/us-caltrain-30d-29N3.test.js`, `tests/us-measured-first-29N3b.test.js`, and every test matching `grep -l "commute_avg\|longest\|subway entrance\|지하철 입구" tests/*.test.js`; list any expectation you updated.

Run only:
```
.venv/bin/pytest -q tests/test_homes_us.py 2>&1 | tail -2
cd web && node --test tests/us-30d-polish-29N3d.test.js tests/us-caltrain-30d-29N3.test.js tests/us-measured-first-29N3b.test.js $(grep -l "commute_avg\|longest\|subway entrance\|지하철 입구" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`data/`, `relay/`, `briefs/`, the demo scenario.

## Final message
Changed files, one line each, plus updated expectations. Nothing else.
