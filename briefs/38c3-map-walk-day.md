# Stage 38c3 — map walk shows the same day and minute as the moment (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named test passes.

## Found by the orchestrator (saved run dumped from IndexedDB)
- **Wrong day.**
  - Trips and aways carry a **0-based** `day`. The URL `day` is **1-based**: `main.js:2029` reads `Number.parseInt(PARAMS.get("day")) - 1`.
  - `MapWalk` (`web/src/ui/mapwalk.jsx:24`, `:147`) passes the URL day straight to `dayTimeline`. So the moment "5일차 08:10 8호선 남한산성입구→모란" showed day index 5 (a Saturday, no commute) instead of 4.
  - In the dump, day 4 has the commute: ride away 469–489.6 with `detail.ride.legs` 8호선 남한산성입구→모란 + 수인·분당선 모란→이매.
- **Wrong start minute.** The 3D page starts at `parseTParam(PARAMS.get("t")) ?? 420` (`main.js:2030`). `MapWalk` ignores `t`.

## Change (`web/src/ui/mapwalk.jsx` only, plus the test)
1. Keep `day` 1-based in state and labels (`5일차`). Call `dayTimeline` with `day: day - 1`.
2. Parse `t` the same way `main.js` does (import `parseTParam` if it is exported from a pure module; otherwise reimplement `HH:MM` / minutes in `mapwalk.js` with a test).
   - Start the slider at that minute, clamped to the day's segment range.
   - When the day changes with the buttons, start at the first segment.

## Test — extend `web/tests/mapwalk-38c.test.js`
- A pure helper you factor out, e.g. `mapWalkParams(url)` → `{ custom, home, dayIndex, startMinute }`.
- `…?custom=x&home=B&day=5&t=08:10` → `dayIndex` 4, `startMinute` 490.
- With no `t` → `startMinute` null. With no `day` → `dayIndex` 0.

Run only:
```
cd web && node --test tests/mapwalk-38c.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head -10
```

## Do not touch
Everything except `web/src/ui/mapwalk.jsx`, `web/src/mapwalk.js` and that test.

## Final message
Changed files, one line each. Nothing else.
