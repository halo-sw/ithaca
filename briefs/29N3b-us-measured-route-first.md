# Stage 29N3b — station-box homes lead with the measured Caltrain route (what the 30-day run lives); the direct bike estimate becomes a side note (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
29N3 made "Live 30 days" ride the measured route for every `us-st-*` home: walk to the station (OSM graph) + wait (half GTFS headway) + Caltrain (GTFS) + bike Menlo Park Stn → Meta HQ (OSM graph). The engine never uses straight-line estimates. But 29N2b's `usCommuteBest` (`web/src/homes.js:~365-383`) lets the direct-bike **estimate** win the headline, sort and pin minutes when it is smaller: all 26 Palo Alto homes and 23 of 25 Redwood City homes show `Bike 26 min (estimate)` on the card and `22 min` on the pin, then the 30-day run commutes ~40 min. The card and the run disagree.

## Change
1. `usCommuteBest` (or its callers at `homes.js:~590` and `~844-870`): for a home in a `us-st-*` area with a labelled Caltrain total, the best/headline is always `{ mode: "caltrain", min: total_min }` (ignore `home.commute.best` there). Keep the direct estimate as `alt: { mode: "bike"|"walk", min }` only when it is smaller. `us-menlo` homes are unchanged (walk/bike from the graph).
2. Card (`web/src/ui/candidate-card.jsx:~130-165`, `commuteRowLine`): station-box homes always print the Caltrain breakdown headline (`Caltrain 40 min · walk 8 + wait 8 + train 3 + bike 22`). When `alt` exists add one muted line `or bike direct about 26 min (estimate, not in the 30-day run)` / `또는 자전거 직행 약 26분(추정, 30일 살아 보기에는 없음)`; the shuttle line stays.
3. Pins, ranking, the spread-out first page and the consult `find_homes` rows use the same headline minutes (`best_min`), and rows carry `bike_direct_estimate_min` when `alt` exists so Muse can mention it as an estimate.

## Tests
New `web/tests/us-measured-first-29N3b.test.js`: a Palo Alto fixture home (`commute.total_min 40.4`, `bike_direct_min 25.9`, `best {mode:"bike",min:25.9}`) → `usCommuteBest` = caltrain 40.4 with `alt` bike 25.9; `commuteRowLine` (English and Korean) headline starts `Caltrain 40 min` / `칼트레인 40분` and has the `(estimate, not in the 30-day run)` line; a `us-menlo` home keeps its walk/bike headline.
Update only the pinned expectations in `tests/map-us-six-29N2c.test.js` / `tests/us-corridor-29N2a.test.js` (or wherever 29N2b pinned "bike estimate wins the headline") and list them.

Run only:
```
cd web && node --test tests/us-measured-first-29N3b.test.js tests/us-corridor-29N2a.test.js tests/map-us-six-29N2c.test.js tests/map-us-live-29N2e.test.js tests/us-caltrain-30d-29N3.test.js $(grep -l "best_mode\|usCommuteBest" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `relay/`, `briefs/`, the engine.

## Final message
Changed files, one line each, plus updated expectations. Nothing else.
