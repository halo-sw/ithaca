# Stage 29N2b — US map draws Caltrain (not Seoul lines), tags never wander far from their home, groups stay inside one town, commute = fastest mode (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why — orchestrator capture after 29N2a (English, "I work at Meta HQ", desktop 1440×900 + phone 390×844)
1. **No Caltrain on the US map.** The map SVG contains the *Seoul* subway lines (`Line 2`, `Shinbundang Line` … off-screen) and no Caltrain line or station labels. `US_NETWORK_URL` exists (`web/src/chat/engine.js:28`) but the chat map still builds its lines from the Seoul `NETWORK_URL`.
2. **A tag far from its home.** Candidate 5 `515 Cleveland Street · $3,541 · 44 min` (Redwood City, -122.2344, 37.4803) is drawn ~340 px north of Redwood City, next to San Carlos, with no leader line; on the phone it is pushed off-frame (only `6` and a card are visible).
3. **A group card mixes towns.** Phone: `4 homes` lists Belle Haven `1`, `2` and Palo Alto `3`, `4` together.
4. **Palo Alto shows the Caltrain route (37–38 min)** although 29N1b's `commute.best` says biking straight to HQ is faster (~22–27 min, estimate). Ranking, pins, cards and Muse's text all use the Caltrain total.

## Changes
1. **US network on the map.** When the shown candidates are US, the chat map loads `region-us/network.json` (Caltrain) instead of the Seoul network, draws the Caltrain line (`#E31837`) with station dots and our labels `Palo Alto Stn` etc. (29N2a helper), and never renders Seoul lines. Korean searches unchanged.
2. **Tags stay near their home.** In the pin layout (`web/src/chatmap.js` `layoutPinLabels` / `layoutMapPills` / the 29M2 pipeline): a tag may move at most 120 px from its dot; whenever it moves more than 24 px a leader line to the dot is drawn; if no spot within 120 px is free, use the compact tag, then join a group card; a tag is never placed outside the free area or dropped silently (every candidate is visible as a tag or a card row).
3. **Groups by town.** Group cards form only among homes of the same area id (`us-menlo`, `us-st-palo-alto` …; Korean: same region). Card header names it: `Belle Haven · 2 homes` / `벨헤이븐 · 2곳`, `Palo Alto · 2 homes`. Two-member groups may still be a card when tags would overlap.
4. **Commute = fastest mode.** For US homes use `commute.best` (`{mode, min}`) everywhere a single commute number is used: ranking (29N2a spread rule unchanged), pin line (`25 min`), card headline (`Bike 25 min (estimate)` / `자전거 25분(추정)`; Caltrain-best homes keep `Caltrain 44 min · walk … + wait … + train … + bike …`), and a second line with the other option (`or Caltrain 37 min · walk 8 + wait 8 + train 3 + bike 22`). `find_homes` results carry `best_mode`/`best_min` so Muse's reply uses the same number.

## Tests — extend `web/tests/us-corridor-29N2a.test.js`
- SSR `ChatMap` with US pins: a `#E31837` path and a `Palo Alto Stn` label; no `Line 2` / `Shinbundang` titles.
- Layout: a pin whose free spots are all > 120 px away ends up in a card or compact tag, never > 120 px from its dot; any tag moved > 24 px has a leader element.
- Grouping: four pins, two areas, all within 72 px → two cards headed `Belle Haven · 2 homes`, `Palo Alto · 2 homes` (or tags), never one mixed card.
- A Palo Alto fixture home with `best:{mode:"bike",min:24}` and a Caltrain total 37 ranks and renders as `24 min`, card `Bike 24 min (estimate)` + `or Caltrain 37 min …`.
Keep green: `tests/map-frame-29M2.test.js`, `tests/pins-commute-29k2.test.js`, the 31-series map tests, `tests/home-names-29M1.test.js`. Update a pinned expectation only for the town-grouping or leader rules, and list it.

Run only:
```
cd web && node --test tests/us-corridor-29N2a.test.js tests/map-frame-29M2.test.js tests/pins-commute-29k2.test.js tests/home-names-29M1.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) $(grep -l "us-menlo" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
30-day engine / 3D, `pipeline/`, `data/`, `briefs/`.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.
