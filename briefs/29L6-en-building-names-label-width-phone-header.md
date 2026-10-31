# Stage 29L6 — English building names read like names; 3D labels are sized by the text they really show; the phone scene header stays on one line (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
Orchestrator captures after 29L5 (2026-11-01, phone 390×844, English, the 3D scene inside the chat panel, Seoul run):
1. **Building names are romanised letter by letter:** `Dongapaelriseubilra` (동아팰리스빌라), `Daehabilding` (대하빌딩), `Elrisiabil` (엘리시아빌), `Yeoksam-dong Dasedaejutaek` (역삼동다세대주택), the compare tray says `A Sinilyutobil · B Daehabilding` while Muse's own answer says `Daeha Building`. `romanizeWord` (`web/src/i18n/romanize.js:44-57`) has no ㄹ+ㄹ → `ll` rule (gives `lr`), and `romanizeName` (`:105-126`) knows only the 역/동/구/시 suffixes, so loanword parts (빌딩, 빌라, 팰리스…) and generic building types run into one word. The DOM translator (`web/src/i18n/translate.js`) and `placeNameEn` (`web/src/ui/scene-chrome.js:69`) both go through `romanizeName`, so fixing it there fixes the tray, the cards and the 3D labels at once.
2. **English 3D labels are cut at the right edge** (`Yeoksamdongb…`, `Yeoksam-dong Dasedaejutaek` over the frame). Cause: the box handed to `placeLabels` is estimated from the Korean title, `w = [...title].length * 13 + 24` (`web/src/main.js:~1830`), and the English text replaces it after placement — the painted box is 2–3× wider than the box that was clamped.
3. **Phone scene header wraps to three lines:** `Day 1` / `18:17 ·` / `B` next to `To the map` and `Open in new window`.

## Changes
1. **`romanize.js`.**
   - `romanizeWord`: ㄹ final + ㄹ initial → `l` + `l` (`팰리스` → `paelliseu`, `엘리시아` → `ellisia`, `설렁` → `seolleong`).
   - `romanizeName`: before romanising a word, split off a trailing known part and render it as an English word, the rest romanised and capitalised, joined by a space. The table, longest match first: `다세대주택`→`Multi-family house`, `연립주택`→`Row house`, `단독주택`→`House`, `주상복합`→`Mixed-use`, `오피스텔`→`Officetel`, `아파트`→`Apt`, `빌딩`→`Building`, `빌라`→`Villa`, `맨션`→`Mansion`, `팰리스`→`Palace`, `타워`→`Tower`, `하우스`→`House`, `캐슬`→`Castle`, `파크`→`Park`, `힐스`→`Hills`, `빌`→`Vill` (only when at least two syllables remain before it). Repeat once so `동아팰리스빌라` → `Donga Palace Villa`. The 역/동/구/시 rules and `NAMES` still win. A word that is only a generic type (`다세대주택`) becomes just the English word; a `동` prefix before a type keeps its `-dong` (`역삼동다세대주택` → `Yeoksam-dong Multi-family house`).
   - Expected: `대하빌딩` → `Daeha Building`, `엘리시아빌` → `Ellisia Vill`, `신일유토빌` → `Sinilyuto Vill`, `역삼우성아파트` → `Yeoksamuseong Apt`, `레이크팰리스` still `Lake Palace` (table in `scene-chrome.js`), `강남역` still `Gangnam Stn`.
2. **Label width from the shown text (`main.js` caller, ~1820-1835).** Estimate `w` from the string that will actually be painted in the current language: on English, the title passed through the same function the label element uses to show English (or `placeNameEn`); width = Hangul chars × 13 + other chars × 7.5 + 24 (+ glyph), rounded up; `sub` line counted too when it is wider. Better still, when a label element for that id is already painted with the same text, use its measured `offsetWidth`/`offsetHeight` (cache by id + text) so the clamp in `placeLabels` and the paint agree exactly. Korean unchanged except where the measured width is used.
3. **Phone scene header (≤ 480 px, the chat-panel 3D header, grep `새 창으로` / `Open in new window` in `web/src/ui`).** The title (`1일차 18:17 · B` / `Day 1 18:17 · B`) never wraps (`white-space: nowrap`, no ellipsis); on ≤ 480 px the actions use short labels built in code — `To the map` → `Map`, `Open in new window` → `New window` (Korean `지도로`, `새 창으로` stay); full text in `aria-label`/`title`. The header row fits 390 px on one line in both languages.

## Tests — new `web/tests/en-names-29L6.test.js`
- `romanizeName` cases above, plus `팰리스` alone → `Palace`, `강남역` → `Gangnam Stn`, `잠실동` → `Jamsil-dong`; no output contains `lr`.
- The label width helper (export it from wherever you put it, e.g. `labelBoxW(title, lang, opts)`): `labelBoxW("역삼동다세대주택", "en")` is ≥ the width of `Yeoksam-dong Multi-family house` at 7.5 px/char + 24, and `labelBoxW("역삼동다세대주택", "ko")` equals the old Korean estimate.
- `placeLabels` with that English width on a 390-wide stage returns a box inside `[4, 386]` or drops it.
- The phone header label helper returns `Map` / `New window` on English phone and the full text on desktop.
Keep green: `tests/scene-chrome-29L2.test.js`, `tests/map-stations-29L3.test.js`, and any test that pins romanised output (`grep -l "romanize" tests/*.test.js`) — update a pinned expectation only when it pinned the old letter-by-letter form of a name with a part from the table above, and say so in the final message.

Run only:
```
cd web && node --test tests/en-names-29L6.test.js tests/scene-chrome-29L2.test.js tests/map-stations-29L3.test.js $(grep -l "romanize\|placeLabels" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
Route/lighting/camera, consult/verify, the relay, `briefs/`.

## Final message
Changed files, one line each, plus any pinned expectation you updated. Nothing else.
