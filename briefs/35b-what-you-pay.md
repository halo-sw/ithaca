# Stage 35b — "내가 내는 돈": what you pay once, what you pay every month, what is left out (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md` (Astryx first, tokens, no `text-overflow: ellipsis`, never 13 px). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. Stages 35a (purchase costs) and 35c (매매 default) are in the tree. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer asked (2026-11-01): when buying a home, "split the amounts I have to pay." 35a computes them. `tenureCost` 매매 now returns this breakdown:
```
housing.breakdown = { kind: "trade", price_won, one_off_items: [{ key, label_ko, won, rate_pct, basis_ko, source_ko }],
  one_off_total_won, cash_won, loan_won, own_money_won, loan_share_pct, loan_rate_pct, loan_years, note }
housing.monthly_won   // the loan payment (원리금균등)
housing.disclaimers   // includes TRADE_COSTS_NOTE
purchaseCosts(...).notes // left-out items (money/purchase.js)
```
The screens do not show any of it yet:
- The result card (`ui/chat.jsx` `ResultSummary` `:864-960`) has one row, `월 주거비`.
- `HowCalculated` (`ui/money.jsx:61-85`) for 매매 says only "대출 갚는 돈 … / 집값 중 내 돈 …".

## Change
0. **One old test (from 35c).** `web/tests/profile-labels-13e2.test.js:30-40` pins that every row except `salaryAnnual` reads `물어볼 값` after "연봉 4천". Since 35c the KRW tenure defaults to 매매 with source `default`, so the `tenure` row reads `기본값`. Update that test: the tenure row is `기본값` with value `trade`; every other row stays `물어볼 값`; exactly one `내가 말한 값`. Do not change `profile.js` or `engine.js` for this.
1. **New `PurchasePayments({ housing, maintenanceWon, transitWon, lang })`** in `ui/money.jsx` (pure render, Astryx `VStack`/`Text`, tabular numbers). Three groups:
   1. **`살 때 한 번에 내는 돈`**
      - `집값 {price}`, then each `one_off_items` row: label, amount, `basis_ko` in supporting text, and `source_ko` as a small source line. `중개보수` reads `중개보수 (상한)`.
      - A total line: `합계 {price + one_off_total}`.
      - Under it: `그중 내 돈 {own_money} · 빌리는 돈 {loan} (집값의 {loan_share_pct}%)`.
   2. **`매달 내는 돈`**
      - `대출 갚는 돈 {monthly} (이자율 {rate}% · {years}년 · 매달 같은 금액, 정해 둔 값)`;
      - `관리비 {maintenance}`;
      - `교통비 {transit}`, when given;
      - total line `합계 {sum}`. It must equal `monthlyHousingOf(...).monthly` for that home.
   3. **`넣지 않은 돈`**: a `Collapsible`, closed by default, listing `purchaseCosts(...).notes` (import them from `money/purchase.js`, or carry them on the breakdown if 35a put them there). Add the line `대출을 받을 수 있는지(LTV·DSR)는 판단하지 않아요.`
   - Amounts use `fmtWon` (full won) in the lines and `fmtWonShort` in the totals. No ellipsis, and long lines wrap.
2. **Result card** (`ui/chat.jsx`):
   - In `ResultSummary`, when a home's tenure is `매매`, add a row after `월 주거비`, labelled `살 때 드는 돈`. Each home's cell shows:
     - main: `fmtWonShort(price + one_off_total)`;
     - note (`ui-result-note`): `내 돈 {short} · 대출 {short}`.
   - A home that is not 매매 shows `–` in that row. Homes that are all non-매매 show no row.
   - The `어떻게 계산했나요` details (`:1066-1083`) becomes `내가 내는 돈` for 매매 homes, rendering `PurchasePayments` per home (A, B) instead of `HowCalculated`. Non-매매 homes keep `HowCalculated`.
   - Open this section by default when any home is 매매. It is the answer the customer asked for.
3. **Money tab** (`ui/money.jsx`): wherever `HowCalculated` renders for a 매매 home, render `PurchasePayments` instead. Line `:307` shows `TRADE_TAX_NOTE`; show the new `TRADE_COSTS_NOTE` text there (35a kept the alias).
4. **Phone (390 px)**: the three groups stack and every amount stays on screen, with no horizontal scroll.

## Test — new `web/tests/what-you-pay-35b.test.js` (SSR / source, no DOM)
- **Render:** `PurchasePayments` for price 9억, cash 3억, 84 ㎡, 4 %, 30 years renders:
  - `취득세`, `지방교육세` and `중개보수 (상한)` with their amounts;
  - `합계`;
  - `그중 내 돈`;
  - `대출 갚는 돈`;
  - `넣지 않은 돈`.
- **Monthly total:** the 매달 total equals `monthlyHousingOf` for a doc built from that housing (housing + maintenance + transit).
- **Result card:** `ResultSummary` with a 매매 doc has a `살 때 드는 돈` row. With an all-전세 doc it has none.
- **CSS / source pins:** no `text-overflow: ellipsis` in the new rules, and no `13px`.
- **Keep green:** every test mentioning `ResultSummary`, `HowCalculated`, `monthlyHousingOf`, `TRADE_TAX_NOTE` or `money.jsx`.

Run only:
```
cd web && node --test tests/what-you-pay-35b.test.js tests/profile-labels-13e2.test.js $(grep -lE "ResultSummary|HowCalculated|monthlyHousingOf|TRADE_TAX_NOTE|money\.jsx|tokens-28c|landing-hero-31c" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/money/**` except importing from it, `src/i18n/**`, `src/engine/**`, `relay/**`, `data/`, `README*`.

## Final message
Changed files, one line each. Nothing else.
