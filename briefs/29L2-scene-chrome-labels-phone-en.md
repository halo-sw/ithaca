# Stage 29L2 — The 3D view's chrome fits: toolbar off the edges, labels never cut or on top of people, one-line credit and a timeline that fits a phone, English that reads like English (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here (grep to find the rest). Stop when the named tests pass.

## Why
Orchestrator captures, 2026-11-01 (desktop 1440×900, phone 390×844, Korean + English; standalone `?mode=sim…` and the scene inside the chat panel):
1. **Toolbar glued to the edge.** `.ui-sim13-stage .ui-tools { top: 0; left: 0; }` (`web/src/ui/ui.css:115`) — the card's top-left corner sits flush on the header / panel header line. On a phone the row overflows: `따라가기` is cut at the right with no sign that the row scrolls (`ui.css:1577-1578`).
2. **Building labels cut at the frame and on top of people.** `placeLabels` (`web/src/labels3d.js:282-…`) skips only labels whose box is wholly off-screen, so `· 레이크팰리스 115동`, `레이크팰리스 78세대`, `치타워`, `역삼동빌딩` are drawn half outside the frame. The household chips (`나`, `배우자`) are not obstacles, so on the phone `다세대주택(3세대) 최고 3층` covers `나` and `프리우스역삼아파트` covers `배우자`. Up to `MAX_LABELS = 40` on a 390 px stage.
3. **Credit takes two lines on a phone** and sits on a label: `항공사진 © 국토교통부 공간정보 오픈플랫폼(VWorld) · © OpenStreetMap`. The 2D map already uses a short phone credit (`web/src/ui/chatmap.jsx:712-716`, `© VWorld · © OpenStreetMap`, full text in the title).
4. **Phone timeline overflows:** the speed control (`1× 10× 60×`, `web/src/ui/timeline.jsx:304-306`) is cut at the right.
5. **English panel copy is word-by-word:** `me Moving`, `me · Commuting · …`, `Today Commute home 42 min = Walking 12 min + …`, timeline rows `home`, `workplace (assumed: Pangyo Stn nearby) work`, legend `home` while the others are capitalised. (`web/src/i18n/en-words.js:10,17,50` map 나→me, 집→home, 근무→work.)

## Changes
1. **Toolbar (`ui.css`).** `.ui-sim13-stage .ui-tools` gets `top: var(--ui-s12); left: var(--ui-s12);` (spacing tokens; the 28c spacing test must stay green) and the same inset on the standalone view. On ≤ 480 px: shorter labels built in code per language (`집만 밝게 보기`→`집만`, `동네 전체`→`전체`, `범례` and `따라가기` stay; English `Highlight homes only`→`Homes`, `Whole area`→`Area`, `Legend`, `Follow`), so A·B + four controls fit 390 px without scrolling; keep the full text as `aria-label`/`title`.
2. **Labels (`labels3d.js` `placeLabels` + the caller in `web/src/main.js:~1790-1820`).**
   - Clamp each box inside the stage (shift x/y so `left ≥ 4`, `right ≤ viewW − 4`, `top ≥ 4`, `bottom ≤ viewH − 4`); if the shifted box no longer sits within 48 px of its anchor, drop it (non-`always` items).
   - Add the household chips and the followed person's ring as reserved zones (grep where the 나/배우자 chip elements are positioned in `main.js`; push their client rects into `reserved` like `.ui-tools` / `.ui-simbar`), plus the credit element.
   - Cap the count by stage width: ≤ 480 px → 6, ≤ 900 px → 12, else `MAX_LABELS`. Home and destination (`always`) still come first.
3. **Credit.** On ≤ 480 px the 3D credit shows `© VWorld · © OpenStreetMap` (Korean and English the same), one line, full text in `title`; desktop unchanged.
4. **Phone timeline.** On ≤ 480 px the speed `SegControl` moves into the existing `⋯` menu (as a three-option group there); the date line and strip keep the row.
5. **English copy in the 3D panels.** Build these strings in code per language instead of word-by-word (mark the nodes `data-no-i18n` on English): the member chip / panel headline (`Me`, `Your partner`, `Child`… from `memberLabelFor`), status (`Me · Commuting · Jamsil → Lake Palace (4 min walk left)`), the scene breakdown (`Today's commute home: 42 min = 12 min walking + 26 min subway + 4 min waiting`), timeline rows (`Home`, `Lake Palace`, `Work (assumed: near Pangyo Stn)`), and the legend items capitalised (`Home`, `Walking`, `Subway`, `Work`, `Groceries`, `Park`, `Other`). Korean unchanged.

## Tests — new `web/tests/scene-chrome-29L2.test.js`
- `placeLabels` with an item whose box would cross the right edge returns it shifted inside `[4, viewW−4]`, or drops it when the shift exceeds 48 px; never returns a box outside the stage.
- `placeLabels` with a reserved zone over a non-`always` label drops that label.
- The width cap: 20 items at `viewW = 390` place at most 6.
- `toolsLabelFor("동네 전체", { phone: true, lang: "ko" }) === "전체"`, English phone `Whole area` → `Area`, desktop unchanged (export whatever helper you add under that or a similar name).
- The English breakdown helper returns `Today's commute home: 42 min = 12 min walking + 26 min subway + 4 min waiting` for the 42/12/26/4 input; member chip for 나 is `Me`.
- `ui.css` has `.ui-sim13-stage .ui-tools` with `top: var(--ui-s12)`.
Keep `20e`, `31*`, `28c` and timeline tests green.

Run only:
```
cd web && node --test tests/scene-chrome-29L2.test.js $(grep -l "placeLabels\|ui-tools\|timeline\|labels3d" tests/*.test.js) $(ls tests/*28c*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Route/beacons/lighting/camera (29L1), the 2D chat map, consult/verify, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
