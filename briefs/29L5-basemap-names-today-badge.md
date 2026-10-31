# Stage 29L5 — Let the basemap name the stations where it already does; no repeated "measured" in the Today rows (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Orchestrator captures after 29L3 / 29L2d (2026-11-01):
1. **Station names still double on the Seoul map.** Our station dots sit on our line geometry, which is tens of pixels away from where the VWorld white basemap prints the same station's name, so even with the 29L3 backplate the map reads `청담역 담역`, `강남구청역 역`, `선릉역 역`, `한티역 역`. Meanwhile stations we do not label (`삼성역`, `선정릉역`, `학동역`) read cleanly from the basemap alone.
2. **English Today rows say "measured" twice:** `Line 2 Jamsil→Gangnam (9 min, crowding 91% measured)` next to the `Measured` badge (same for `assumed`). Since 29L2d the row node is translated together with its badge text.

## Changes
1. `web/src/ui/chatmap.jsx` (+ `web/src/chatmap.js` if the decision lives there): when the basemap is on and its provider prints station names (VWorld — `basemapProvider()` / the `provider` value already in the component; not `usgs`, not basemap-off), draw **no station name text** of ours — keep the station dots, the line colours and the `<title>` tooltip on each dot. With USGS or no basemap, keep our labels exactly as 29L3 left them (backplate, 역/Stn names, obstacles). Keep the workplace pill naming its station (`회사 · 강남`).
2. Today list (the 29L2d helper and its rendering): the badge (`실측`/`측정`/`가정값` → `Measured`/`assumed`) is its own node, outside the translated row text, so the row reads `Line 2 Jamsil→Gangnam (9 min, crowding 91%)` and the badge sits beside it. Korean unchanged.

## Tests
- Extend `web/tests/map-stations-29L3.test.js`: SSR `ChatMap` with VWorld basemap on renders station dots with `<title>` but no station-name `<text>`; with provider `usgs` it renders the station-name `<text>` (`… Stn` / `…역`).
- Extend `web/tests/scene-chrome-29L2.test.js`: the Today row for a measured ride renders the badge in a separate element and the row's text node does not contain `실측`/`측정`/`가정값`.
- Update `web/tests/walk-19g.test.js` 19g-3 only if it renders with the VWorld basemap on: then the "picked home stop still labelled" check moves to the dot's `<title>야탑</title>` (or `야탑역`), never removed.

Run only:
```
cd web && node --test tests/map-stations-29L3.test.js tests/scene-chrome-29L2.test.js tests/walk-19g.test.js $(ls tests/*31[a-n]*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
3D scene rendering, consult/verify, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
