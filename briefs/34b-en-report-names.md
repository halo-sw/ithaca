# Stage 34b — English results: household members by English names in Muse's report, one name form for homes (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md` (Astryx first, tokens, no `text-overflow: ellipsis`, no 13 px). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. Stage 34a is committed; build on it. Stop when this part is done.

## Found by the orchestrator (real Chromium, 1440 × 810, `?chat=&lang=en`, live Seoul run with real Muse Spark 1.3)
Messages: "We're an engaged couple. We both work near Gangnam Station. Jeonse under ₩400M, please." → "Pick 1 and 2" → `Live 30 days` → `See the result`.

1. **"na" in the English report.** The result's `Report check` lists Muse's English report sentences, and one reads: "One-way average was 5 minutes for **na** and 5 minutes for spouse."
   - The household's first member is labelled `나` (`web/src/profile.js` `memberLabelFor`, ~781–795). In an English run that Korean label reaches the report / judge inputs, and Muse romanizes it.
   - In the same run the diary and the chat reply are fine. Only the member label leaks.
2. **Korean home names in the English result header.** The `After 30 days of living` card (`chat.jsx` `ResultSummary` and the A / B header above `My-criteria score`) shows `강남역 센트럴 푸르지오 시티 (Gangnam Stn Senteureol Pureujio Siti)` and `목화밀라트 (Mokhwamilrateu)`. In 34a the picks tray switched to one name form in English (`trayNameFor`). The result header still shows both forms, and the long Korean name wraps to four lines.

## Change
1. **English member labels for Muse** (`web/src/consult/report.js`, `report-def.js`, `server.js`/`tools.js` as needed, `profile.js` if a helper fits there):
   - When the run's language is English (the same flag the English chat replies already use), every member label that goes into the report writer's input, the judge's input and the claim checker uses English: `나` → `me`, `배우자` → `spouse`, `아이` → `child`, `부모` → `parent`, `형제자매` → `sibling`, `동거인` → `housemate`, `함께 사는 사람 N` → `housemate N`, `구성원 N` → `member N`. A user-given label (`mem.label`) passes through as is.
   - The number checks in `web/src/verify/numbers.js` (member key lookup ~79) must still map these English labels back to the same engine member, so a sentence about "me" is checked against `나`'s trips. Korean runs stay byte-identical.
   - Keep one mapping table and reuse it. Do not translate with a romanizer.
2. **One name form in the English result header** (`chat.jsx` `ResultSummary` and the A / B header row):
   - Use the 34a `trayNameFor` (or the same helper) so English shows `Gangnam Stn Senteureol Pureujio Siti` and Korean shows `강남역 센트럴 푸르지오 시티`.
   - Long names wrap at word boundaries. Nothing is cut.

## Test — new `web/tests/en-report-names-34b.test.js`
- **Labels:** the English mapping gives `me` / `spouse` / `child` / `housemate 3`; a custom label passes through; Korean returns the old label.
- **Report input:** build the report / judge input for an English two-member fixture (follow the fixtures in the existing report tests). It contains no Hangul member label (`/[가-힣]/` absent from every member field), and the Korean fixture is unchanged.
- **Number check:** an English sentence "me averaged 5 min one-way" checks against member `나`'s numbers (passes with 5, fails with 9).
- **Result header:** with `lang = "en"` the A / B header shows the English form only; Korean shows the Korean form only.
- **Keep green:** every test mentioning `memberLabelFor`, `report-def`, `submit_report`, `verify/numbers`, `ResultSummary` or `trayNameFor`.

Run only (**run it before you finish**):
```
cd web && node --test tests/en-report-names-34b.test.js $(grep -lE "memberLabelFor|report-def|submit_report|verify/numbers|ResultSummary|trayNameFor" tests/*.test.js | tr '\n' ' ') 2>&1 | tail -15
```
If it still fails after 2 fix attempts, stop and print the last lines. The orchestrator re-runs it live in a real browser.

## Do not touch
`src/engine/**`, `src/i18n/**`, `relay/**`, `vite.config.js`, `landing-page.jsx`, `data/`, `README*`, `docs/`.

## Final message
Changed files, one line each. Updated test files. Nothing else.
