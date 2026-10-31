# Stage 34a — the Compare side panel fits, English map pins speak dollars-style won, the picks tray never cuts a name (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md` (Astryx first, tokens, no `text-overflow: ellipsis`, no 13 px). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. Stop when this part is done.

## Found by the orchestrator (real Chromium, 1440 × 810, `?chat=&lang=en`, live Seoul run)
Messages: "We're an engaged couple. We both work near Gangnam Station. Jeonse under ₩400M, please." → "Pick 1 and 2". Muse answered "Saved, and I opened the comparison for you." and the Compare side panel opened on the right of the stage. The customer saw the same screen and asked whether it is fit to film.

1. **The Compare side panel is broken.**
   - `SidePanel` (`web/src/ui/chat.jsx` ~3897–3925) draws its own header (`비교` + `닫기`) and then `<CompareCard state={state} />` **without `bare`**. `CompareCard` (`web/src/ui/app.jsx` ~864–920) then renders the standalone overlay `.ui-compare overlay` (`ui.css:137–140`: `position: absolute; right: 12px; top: 76px; width: 400px`) inside the panel.
   - Result: a card inside a card, two titles (`Compare` / `30-day life comparison`), two `Close` buttons, and the inner card sits shifted out of the panel so its left edge is cut off (`-day life comparison`, `ompare`, `ompare A·B`, `rce Measured`, `e-way commute`).
   - Inside the `Compare A·B` tab the row label (`One-way commute (door → office)`) takes the whole width and the A / B value column is squeezed to one letter, so `A 5 min`, `A takes 1 min more one-way on average` break one letter per line down the panel.
2. **English map pins show Korean money units.** `tagPriceLine(..., "en")` (`web/src/chatmap.js` ~530–551) keeps the Korean short form (`J 2억 6,000`, `J 1억 6,000`, `J 2억`). The candidate cards in the same English screen say `jeonse ₩200M`, `jeonse ₩215M`.
3. **The picks tray cuts the B name.** Bottom tray at 1440: `A 강남역 센트럴 푸르지오 시티 (Gangnam Stn Senteureol Pureujio Siti)` wraps to 3 lines, and B shows `목화밀라트 (|` — the rest of the name is hidden under the `Live 30 days` button.

## Change
1. **Compare in the side panel** (`chat.jsx` `SidePanel`, `app.jsx` `CompareCard`, `ui.css`):
   - In `SidePanel`, render `CompareCard` in its in-flow form (`bare`), never the absolute overlay.
   - One title and one Close in the panel. Keep `결과 공유` (Share result). Use the panel header for the title (`30일 생활 비교` when compare is open, `자세히` for detail) and drop the inner title row's duplicate `닫기`; the overlay (non-bare) form used elsewhere keeps its own header unchanged.
   - Nothing in the panel is clipped horizontally at 1440, 1280 and 1000 px wide, and in the 390 px phone sheet if Compare opens there.
   - Compare rows: when the label and the A / B values do not fit on one line, stack them (label on its own line, then the A and B values) instead of shrinking the value column. Words never break letter by letter (no `word-break: break-all`, keep normal word wrapping; Korean `keep-all` is fine).
2. **English pin price** (`chatmap.js` `tagPriceLine`, `pinPillWidthPx` if needed):
   - With `lang === "en"`, KRW pins use the same short money style the English cards use (`₩260M`, `₩200M`, `₩1.6B` if ≥ 1,000,000,000; check `money/currency.js` and the card code for the existing helper and reuse it): `J ₩260M`, monthly `M ₩600K / ₩10M`, sale `S ₩300M`.
   - Korean pins stay byte-identical (`전 2억 6,000`, `월 60 / 1,000`). USD pins stay `$4,261`. The pill width follows the new text.
3. **Picks tray names** (`chat.jsx` `PicksTray` and its CSS):
   - No name is hidden under the button or cut at the edge. The button keeps its size; the names column takes the remaining width and wraps.
   - In English, the tray shows a picked home's name once, in its English form (the part after the Korean, e.g. `Gangnam Stn Senteureol Pureujio Siti`, `Mokhwamillateu`), not Korean + parentheses. The cards keep both forms as today. Korean tray unchanged.
   - Use whatever `displayNameFor` / translation helper already splits the two forms; do not add a new romanizer.

## Test — new `web/tests/compare-panel-34a.test.js`
- **Side panel:** a source/SSR pin that `SidePanel` renders `CompareCard` with `bare`, and that the panel output has exactly one `닫기` button and no `ui-compare overlay` class.
- **Compare row:** a CSS pin that the compare row stacks when narrow and no rule under the compare card sets `word-break: break-all`.
- **Pins:** `tagPriceLine` for a jeonse ₩260,000,000 candidate → `J ₩260M` in English and `전 2억 6,000` in Korean; monthly 600,000 / 10,000,000 → `M ₩600K / ₩10M` and `월 60 / 1,000`; USD unchanged.
- **Tray:** with `lang = "en"`, the tray name for a candidate whose display name is `목화밀라트 (Mokhwamillateu)` is `Mokhwamillateu`; Korean shows `목화밀라트`.
- **Keep green:** every test mentioning `tagPriceLine`, `shortPinPrice`, `pinPillWidthPx`, `CompareCard`, `SidePanel`, `PicksTray`, `ui-compare` or `compare-tabs`. Update an old test only when it pinned the old English pin text (`J 2억`), and say so in your final message.

Run only (**run it before you finish**):
```
cd web && node --test tests/compare-panel-34a.test.js $(grep -lE "tagPriceLine|shortPinPrice|pinPillWidthPx|CompareCard|SidePanel|PicksTray|ui-compare|compare-tabs" tests/*.test.js | tr '\n' ' ') 2>&1 | tail -15
```
If it still fails after 2 fix attempts, stop and print the last lines. The orchestrator re-checks in a real browser.

## Do not touch
`src/engine/**`, `src/consult/**`, `src/i18n/**`, `relay/**`, `vite.config.js`, `landing-page.jsx`, `data/`, `README*`, `docs/`.

## Final message
Changed files, one line each. Updated test files (and any old test you changed, with why). Nothing else.
