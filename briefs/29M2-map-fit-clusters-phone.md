# Stage 29M2 — The chat map frames the homes: tags stay inside the free area, a tight group becomes one list card, English pins read plainly (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep for the rest). Stop when the named tests pass.

## Why
Orchestrator captures of the chat map right after the first search (2026-11-01, desktop map stage ≈ 640×585 css px at 1440×900, phone 390×844):
1. **US (Meta HQ, 6 homes on Coleman Ave / Hamilton Ave, all within ~250 m, workplace ~2 km north-east).** Desktop: the six tags stack on top of each other at the bottom of the stage — `5 · 13 min to work` is cut by the bottom edge, `4`/`1`/`6`/`2` overlap one another — while the top half of the free area is empty. Phone: the same stack, `2 · 12 min to work` touches the bottom, the `© USGS` credit is buried under the tags, and the workplace pill `Work · Meta HQ (1 Hacker Way)` runs to the right edge with no gap.
2. **Seoul (Gangnam, 6 homes).** The homes and workplace occupy only the left half of the free area; the right half is empty. `Work · Gangnam` sits on top of pin 1's dot.
3. **English price line on Seoul pins:** `J ₩273M`. The `J` is unreadable; every pin shares the filter's tenure (`Jeonse` chip).
4. **English Seoul map has no readable station names:** since 29L5 we draw no station text over the VWorld basemap, whose labels are Korean only (`선릉역`) — fine for Korean, but an English reader sees no station names.
5. **Phone chip row** (`$4,500 or less ▾  Commute ▾  Home type ▾`) runs under the map's `✕` close button — `Home type ▾` is cut.

`fitMapView` / `fitInsetFromChrome` (`web/src/chatmap.js:149-260`) frame the *points*; the fan-out in `layoutPinLabels` (`:654-`) and `layoutMapPills` (`:788-`) then pushes tags outside the framed area, and nothing re-checks.

## Changes
1. **Frame what is drawn.** After laying out pins/tags (`web/src/ui/chatmap.jsx:~317-510`), if any tag box (or the workplace pill) leaves the free area (stage minus the chrome insets already computed: top chips/title/legend, right controls, bottom tray/credit), refit once with the union of the laid-out boxes converted back to map extent (or simply zoom out one step and re-centre on the union), then lay out again. Centre the union of pins + workplace in the free area (not in the full stage). At most two passes.
2. **A tight group becomes one list card.** When ≥ 3 pins' tags would overlap at the fitted zoom (their anchors within the existing fan radius), draw one card instead of fanned tags: header `6 homes` / `집 6곳` (count of the group), then one row per home in list order — `1 · 11 min to work`, `2 · 12 min to work` … (same row content the single tag uses: price line when prices differ, commute line), each row a button with the same hover/click behaviour as that pin (`onPinHover`, `onPinClick`, picked Ⓐ/Ⓑ marks). The card has one leader to the group's centroid dot; individual dots stay on the map, small. The card is placed inside the free area like any tag (obstacles: chrome, workplace pill, credit). Zooming in (the + control or wheel) splits the group back into tags when they no longer overlap. Keep the existing `+N` cluster pill only where a card would not fit (e.g. > 8 rows → first 6 rows + `+N more`).
3. **English price line:** when every pin shares one tenure, the price line has no tenure letter in English (`₩273M`, `$4,261`), and the legend says which: `No.·area / jeonse / commute` (`전세`/`월세`/`매매` in Korean stays as it is today). Mixed tenures keep the 34a letters.
4. **English station names over VWorld:** in English only, draw our station plates again over the VWorld basemap (`Seolleung Stn`, 29L3 placement and obstacles); Korean keeps 29L5 (dots only). USGS unchanged.
5. **Credit and workplace pill are obstacles** for tags/cards, and the workplace pill keeps ≥ 8 px from every stage edge (`placeWorkplacePill`, `:958`).
6. **Phone chip row** (≤ 480 px): the chips row ends before the `✕` (reserve its width + 8 px, the row scrolls horizontally inside itself if needed — no text cut, no ellipsis).

## Tests — new `web/tests/map-frame-29M2.test.js`
Use the real US candidates if a fixture exists (`grep -rl "Coleman" tests/fixtures scenarios | head`), else six points within 250 m plus a workplace 2 km NE.
- Desktop 640×585 and phone 390×600 stage: after layout every tag/card box and the workplace pill lie inside the free area (≥ 4 px from edges and outside the chrome insets), and no two boxes overlap.
- The six-home US group renders as one card (`6 homes`) with six row buttons in SSR; each row carries the pin's id (data attribute) so click/hover map to that pin.
- The union of pins + workplace is centred in the free area within 15 % of its width/height (Seoul fixture or synthetic).
- `tagPriceLine` English with a single shared tenure → `₩273M` (no `J `); mixed tenures keep `J ₩273M`; legend English contains `jeonse`.
- SSR `ChatMap` English + VWorld: station plate text `… Stn` present; Korean + VWorld: none (29L5 test stays green).
Keep green: `tests/map-stations-29L3.test.js`, `tests/walk-19g.test.js`, `tests/pins-commute-29k2.test.js`, every `tests/*31[a-n]*.test.js`, and the 34a test (`ls tests/*34a*.test.js`). Update a pinned expectation only when it pinned the old `J ₩` letter for a single-tenure set or the fanned layout of a tight group, and list it in the final message.

Run only:
```
cd web && node --test tests/map-frame-29M2.test.js tests/map-stations-29L3.test.js tests/walk-19g.test.js tests/pins-commute-29k2.test.js $(ls tests/*31[a-n]*.test.js tests/*34a*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
3D scene, consult/verify, `briefs/`.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.
