# Stage 29N2e — Live US map: candidate 5 still stacked under 6, Caltrain network never fetched, Korean sources on US homes (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Evidence — orchestrator, real browser, after 29N2d (English, "I work at Meta HQ", 1440×900; map `<svg>` at client x 519, y 56, 921×844)
1. **Still stacked.** `[aria-label^="Candidate 5"]` (`515 Cleveland Street`, -122.2344163, 37.4803242, Redwood City) has its box at client `555,285 72×70` — exactly where candidate 6 (`553 West El Camino Real`, San Carlos) is drawn, so 5 is invisible (phone 390×844: also invisible). A lone dot is drawn near San Mateo County, nothing at Redwood City. The SSR tests (29N2c `map-us-six-29N2c`) pass, so the live pipeline differs from what the tests run. Measured chrome in the live page (client px): filters row `531,68 351×32`; legend `531,148 303×35`; right controls column at the right edge; credit bottom-right. Suspects: (a) layout is computed in the first-pass fit and drawn with the refit / zoom transform (29M2 two passes), (b) the measured chrome boxes are in client coordinates while the layout works in SVG coordinates (missing the `519,56` offset), (c) clamping two tags to the same free-area corner.
2. **Caltrain never fetched.** The page requests `/data/region/network.json` twice and never `/data/region-us/network.json`, although every candidate is US (`region: "us-…"`, `currency: "USD"`). The 29N2b switch is not reached in the live chat flow (check where the chat map gets `network` in `web/src/ui/chat.jsx` / `web/src/chat/engine.js` — the US decision must use the candidates' regions/currency at that moment).
3. **Korean sources on US homes.** `find_homes` returns US candidates with `sources: ["실거래(국토교통부 25.10–26.10)", "도보(그래프)"]`. US homes must say `Zillow ZORI (ZIP typical rent, 2026-09)`, `OSM walk/bike graph`, `Caltrain GTFS (2026-06)` as applicable (`web/src/consult/tools-search.js` / `web/src/homes.js`).

## Changes
Fix all three at the root. For (1), make the SSR/test path and the live path use the same coordinates: convert measured chrome to SVG/stage coordinates once, lay out and draw with the same final fit, and re-check collisions after every clamp (29N2c). Add a test that drives `ChatMap` (or the extracted layout pipeline) with exactly the live inputs above — the six homes (coordinates in `briefs/29N2c-map-no-stacked-tags.md`), HQ, stage 921×844, chrome boxes converted from the client rects above — and asserts six distinct visible boxes (or card rows), none overlapping, each ≤ 120 px from its dot.
For (2), a test that the chat map's network choice for a US candidate set is the `region-us` URL. For (3), a test on a US `find_homes` result's `sources`.

Run only:
```
cd web && node --test tests/map-us-six-29N2c.test.js tests/us-corridor-29N2a.test.js tests/chatmap-18.test.js tests/walk-19g.test.js tests/map-frame-29M2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) $(grep -l "us-menlo\|find_homes" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
`pipeline/`, `data/`, `briefs/`.

## Final message
Changed files, one line each, and which suspect (a/b/c or other) was the cause. Nothing else.
