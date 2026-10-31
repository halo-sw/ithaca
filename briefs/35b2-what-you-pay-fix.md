# Stage 35b2 — "내가 내는 돈": one-off amounts must not read as monthly, and a clearer layout (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md` (Astryx first, tokens, no `text-overflow: ellipsis`, never 13 px). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. 35b is in the tree (uncommitted). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (real Chromium, live Seoul run, 매매 9억 이하 / 모은 돈 3억)
1. **Lump sums print as monthly.** `fmtWonShort` (`money/format.js:68-89`) is the *monthly* short form, so it always starts with `월`. The 35b brief told you to use it for totals; that was the orchestrator's mistake.
   - The result card row `살 때 드는 돈` shows `월 28,674만 원` (EN `₩286.7M/mo`).
   - Its note shows `내 돈 월 28,674만 원 · 대출 월 0 원`.
   - The one-off `합계` in `PurchasePayments` has the same problem.
2. **Mixed formats in one list.** The monthly lines use `fmtWon` (full won), and the monthly `합계` uses `fmtWonShort` (rounded to thousands). Lines and their total should use one form.
3. **Lines with nothing to pay.**
   - `교통비 월 0 원` shows when the commute is on foot.
   - When the savings cover everything, `대출 갚는 돈 월 0 원 (이자율 …)` reads like a loan exists.
4. **Flat hierarchy.** Group titles, item lines, basis lines and source lines all look alike. At 1440 px one home's breakdown is about 25 lines.

## Change
1. **New lump-sum formatter** in `web/src/money/format.js`: `fmtWonLump(won)`.
   - No `월` prefix.
   - At 1억 and above, round to 만: `286,740,000 → "2억 8,674만 원"`, `900,000,000 → "9억 원"`.
   - Below 1억, same as `fmtWon`. `0 → "0 원"`.
   - Do not change `fmtWon` or `fmtWonShort`; other screens use them.
2. **Result card** (`ui/chat.jsx`, the 35b `살 때 드는 돈` row):
   - main = `fmtWonLump(total)`;
   - note = `내 돈 {fmtWonLump(own)} · 대출 {fmtWonLump(loan)}`, or `내 돈 {…} · 대출 없음` when the loan is 0;
   - the `title` attribute uses the same lump form.
3. **`PurchasePayments`** (`ui/money.jsx`):
   - **Rows.** Each money line is a row: label on the left, amount on the right (tabular numbers). Use Astryx `HStack` with space-between; the label wraps and the amount never shrinks. Phone width (390 px): the amount stays on the same row or wraps under the label, never off screen.
   - **Basis and source.** One `supporting` line under its row: `{basis_ko} · {source_ko}`, instead of two lines.
   - **Group titles.** `살 때 한 번에 내는 돈`, `매달 내는 돈` and the home name are visibly titles (semibold, a bit of space above). Item rows are regular weight.
   - **Totals.** Each `합계` row is semibold, with a thin divider above it (token border colour).
   - **One-off amounts.** The price row, item rows, the one-off `합계` and `그중 내 돈 · 빌리는 돈` use `fmtWonLump`. Above 1억 they round to 만, below 1억 they stay exact.
   - **Monthly amounts.** Monthly rows and the monthly `합계` all use `fmtWon(…, { monthly: true })`, so the total is the exact sum of the rows shown.
   - **Lines with no money.**
     - `교통비` only when > 0.
     - When `loan_won` is 0, the loan row reads `대출 갚는 돈 없음` with the note `모은 돈으로 다 낼 수 있어요`, and `그중 내 돈 … · 빌리는 돈 …` becomes `모두 내 돈으로 내요`.
4. **No other screens change.**

## Test — extend `web/tests/what-you-pay-35b.test.js`
- **Formatter:** `fmtWonLump(286740000) === "2억 8,674만 원"`, `fmtWonLump(900000000) === "9억 원"`, `fmtWonLump(2825000) === "282만 5,000 원"`, `fmtWonLump(0) === "0 원"`.
- **Result card:** the `살 때 드는 돈` row for a 매매 doc never contains `월`. With cash ≥ upfront it shows `대출 없음`.
- **PurchasePayments:**
  - The one-off group never contains `월 `.
  - With transit 0 there is no `교통비` row.
  - With loan 0 it shows `대출 갚는 돈 없음` and `모두 내 돈으로 내요`.
  - The monthly `합계` equals the sum of the monthly rows (parse the rendered won).
- **Keep green:** the 35b test command's file list, plus every test that mentions `fmtWon`.

Run only:
```
cd web && node --test tests/what-you-pay-35b.test.js tests/profile-labels-13e2.test.js $(grep -lE "ResultSummary|HowCalculated|monthlyHousingOf|TRADE_TAX_NOTE|money\.jsx|fmtWon|tokens-28c|landing-hero-31c" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**` (the orchestrator adds English), `src/engine/**`, `relay/**`, `data/`, `README*`. In `src/money/**` add only `fmtWonLump`.

## Final message
Changed files, one line each. Nothing else.
