# Stage 36g — "공식" only when every leg is from the timetable, the follow marker does not jump at the station, the aerial credit in English (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; the suite is green (2812). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (live Korean session, 2026-11-01)
1. **A partly estimated ride is labelled official.**
   - The card reads `송파나루 → 판교 총 35분 · 송파나루역 걸어서 2분 + 지하철 32분 공식`.
   - That ride's legs: only 8호선 석촌 → 복정 is from the timetable (`method: "schedule"`). 9호선, 수인·분당선 and 경강선 are km × 1.43 min/km (`method: "estimate"`), plus 3 × 4-minute assumed transfers.
   - `web/src/ui/candidate-card.jsx:95` and `:138` label it `official` as soon as **any** leg used the schedule (`methodsUsed.includes("schedule")`).
2. **The follow marker jumps** (`docs/3d-fidelity.md` item 7). The walk ends at the OSM station node, and the ride starts at the line data's stop, which can be about 145 m away, so the marker leaps. Seen at 잠실; the same code runs for every station (`web/src/engine/routines.js:333-339`, `web/src/journey.js:93-106`).
3. **The credit stays Korean in English.** `항공사진 © 국토교통부 공간정보 오픈플랫폼(VWorld) · © OpenStreetMap` stays Korean on `?lang=en`. The English 3D credit should read `Aerial photo © MOLIT Spatial Information Open Platform (VWorld) · © OpenStreetMap` (the chat map already writes `Map © MOLIT Spatial Information Open Platform (VWorld)`). Find `SimCredit` (`ui/app.jsx`). If it carries `data-no-i18n` or builds the line from several text nodes, build the whole line per language in one string, as 29a6b did for the replay banner.

## Change
1. **Official only when the timetable covers every leg** (`candidate-card.jsx:95`, `:138`, and any other place that maps `derived` to `official`; `grep -n "methodsUsed" web/src`):
   - `official` when every leg's method is `schedule` (and the ride is not customer-said);
   - `estimate` when any leg is `estimate`.
   - The same-station and walk-only cases keep today's labels.
   - The chat reply's `(추정)` / `공식` wording follows the same rule. Find where it is written, e.g. `grep -rn "일부 승차 추정\|공식" web/src/consult web/src/chat`.
2. **Marker continuity** (`journey.js` / `routines.js`):
   - When a walk ends at a station node and the next ride's first stop is a different point, draw and animate a short connector: walk on to the ride's stop position. Either append the network stop as the walk's last point, or start the ride path at the walk's end point. Pick whichever keeps the minutes unchanged.
   - Do not change the walk minutes or the ride minutes; this is drawing only.
   - Same at the alighting end.
3. **English credit.** One string per language in `SimCredit`:
   - Korean stays exactly as today.
   - English: `Aerial photo © MOLIT Spatial Information Open Platform (VWorld) · © OpenStreetMap` when the photo is draped, `© OpenStreetMap` otherwise.
   - US areas keep their USGS credit.

## Test — new `web/tests/official-marker-36g.test.js`
- **Labels:**
  - a ride with legs `[schedule, estimate]` → `estimate`;
  - `[schedule, schedule]` → `official`;
  - customer ride → `said`;
  - same station → unchanged.
- **Real data** (skip when `data/build` is missing): `commuteSummary` for `home-014844` (송파나루) to 판교, through the card helper, gives `estimate`.
- **Marker:** for a fake walk ending at point P and a ride whose first stop is Q, 145 m away, the drawn path has no gap > 5 m between the walk's last point and the ride's first point. The minutes are unchanged.
- **Credit:** SSR `SimCredit` with English selected and `aerial: true` contains `Aerial photo © MOLIT` and no Hangul. Korean is unchanged.
- **Keep green:** every test that mentions `commuteRowLine`, `methodsUsed`, `SimCredit`, `journey.js` or `routines.js`.

Run only:
```
cd web && node --test tests/official-marker-36g.test.js $(grep -lE "commuteRowLine|methodsUsed|SimCredit|journey\.js|routines\.js|공식" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**` (if a new English string is needed outside SimCredit, list it in the final message), `relay/**`, `data/`, `README*`, `scenarios/`, `pipeline/**`, `public/recorded/**`.

## Final message
Changed files, one line each. Old tests you changed, with why. Nothing else.
