# Stage 36j — cards without a street photo link out to Kakao Map Roadview (Korea) / Google Street View (US) (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why
Card thumbnails fall back to our 3D model when Mapillary has no photo (32c/36d, `web/src/ui/candidate-card.jsx:~330-540`, `thumbKindFor` ~533). In Korea Mapillary is sparse: 다누림빌 (gangnam `home-004928`, 127.030673, 37.5222776) has no photo within the relay's ±165 m; 산성역 `home-016655` (sujeong, 127.1544264, 37.4571344) none within 555 m. The user wants a way to see the real street. We do not fetch or embed any Kakao/Google imagery (their terms) — a plain outbound link only.

## Change
1. One pure helper, e.g. `streetViewLinkFor(candidate)` in `candidate-card.jsx` (or `web/src/sources.js` beside the Mapillary credit helpers): finite lon/lat required, else `null`.
   - Korea (not `isUsLonLat`): `{ href: "https://map.kakao.com/link/roadview/${lat},${lon}", label: "카카오맵 로드뷰로 보기" }` (English UI: `View on Kakao Map Roadview`).
   - US: `{ href: "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}", label: "Google 스트리트 뷰로 보기" }` (English: `View on Google Street View`).
   - lat/lon rounded to 6 decimals. The URL carries the home's position only, never the viewer's.
2. Card row (`CandidateRow`, ~860-1000) and the detail view's photo switcher (~990-1040): when the resolved thumb kind is not `"street"` and not `"hero"` (i.e. 3D / silhouette / minimap), show one small muted link line under the commute lines: `<a href target="_blank" rel="noopener noreferrer">` + label + ` ↗`. Clicking it must not trigger the row click / pick (stop propagation, like the 담기 button). When a street photo or a complex photo shows, no link.
3. Add the two English strings to the i18n table the card already uses (`web/src/i18n/en-table.js`).

## Tests — new `web/tests/street-view-link-36j.test.js`
- `streetViewLinkFor` on the two Korean homes above → exact Kakao URLs (`.../roadview/37.522278,127.030673` and `.../roadview/37.457134,127.154426`) and the Korean label; on a US home (`124 University Avenue`, -122.1633463, 37.4436871) → the Google pano URL; no lon/lat → `null`.
- Rendering a card (reuse the render helper an existing candidate-card test uses) with no street photo shows the link with `target="_blank"` and `rel` containing `noopener`; with a street photo (`street` prop) there is no link.
Keep green: `$(grep -l "candidate-card\|thumbKindFor\|streetPhoto" tests/*.test.js)`; list any expectation you updated.

Run only:
```
cd web && node --test tests/street-view-link-36j.test.js $(grep -l "candidate-card\|thumbKindFor\|streetPhoto" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each, plus updated expectations. Nothing else.
