# Stage 35a — buying a home: what you pay once, from the law's own rates (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer decided (2026-11-01) that Ithaca works from **buying a home (매매)**, not 전세. "전세 is too special a case." They want the amounts they must pay split clearly.

Today the 매매 branch of `tenureCost` (`web/src/money/tenure.js:101-111`) does two things:
- It amortises `price − cash` and ignores every one-off purchase cost.
- It says so in `TRADE_TAX_NOTE` (`tenure.js:18-19`): "집을 살 때 내는 세금·중개수수료는 포함하지 않아요."

```js
  // 매매
  const price = Math.max(0, Math.round(Number(args.price_won) || 0));
  const loan = Math.max(0, price - cash);
  const monthly = amortisedMonthly(loan, rate, years);
  return out(monthly, price, loan, {
    kind: "trade",
    price_won: price,
    note: "빌린 돈을 매달 같은 금액씩 갚을 때 한 달에 내는 돈이에요.",
  }, { notes: [TRADE_TAX_NOTE] });
```

This stage adds the one-off costs from published rates (pure functions, no UI). The UI comes in 35b.

## Rates (checked by the orchestrator in the official sources, 2026-11-01)
1. **취득세** (지방세법 제11조 제1항 제8호, 시행 2026-01-01, 법률 제21308호): 유상거래 주택, taking 취득당시가액 = the price.
   - Up to 6억: 1천분의 10 (1 %).
   - Over 6억 and up to 9억: rate % = (price ÷ 1억 × 2/3) − 3, rounded at the fifth decimal place of the rate as a fraction, i.e. kept to 4 decimal places. Examples: 7.5억 → 2 %, 6억 → 1 %, 9억 → 3 %.
   - Over 9억: 1천분의 30 (3 %).
   - These are the rates for a household buying its only home (1주택). The multi-home surcharge (지방세법 제13조의2) and 생애최초 relief are **not applied**. Say so in the note.
2. **지방교육세** (지방세법 제151조 제1항 제1호): for these housing rates, 10 % of the 취득세 amount. So 1 % → 0.1 % of the price, 3 % → 0.3 %.
3. **농어촌특별세** (농어촌특별세법 제5조): only when the exclusive area is **over 85 ㎡**: 0.2 % of the price. Up to 85 ㎡: 0 (비과세). When `area_m2` is unknown, leave it out and add the line "면적을 몰라 농어촌특별세(85㎡ 초과 시 0.2%)는 넣지 않았어요."
4. **중개보수 상한** (서울특별시 주택중개보수 등에 관한 조례 제2조 별표1, 시행 2021-12-30; 매매·교환):

   | 거래금액 | 상한요율 | 한도액 |
   |---|---|---|
   | under 5천만 | 0.6 % | 25만 원 |
   | 5천만 to under 2억 | 0.5 % | 80만 원 |
   | 2억 to under 9억 | 0.4 % | — |
   | 9억 to under 12억 | 0.5 % | — |
   | 12억 to under 15억 | 0.6 % | — |
   | 15억 and over | 0.7 % | — |

   This is the **ceiling** (상한). The actual fee is agreed with the agent, so label it "상한" and never call it the fee. VAT is not included. Every area in the app today uses this Seoul table, including 성남, 용인 and 위례; the note says it is the Seoul table.

Amounts: round each item to whole won (`Math.round`). Every item carries its legal source text as given above.

## Change
1. **New `web/src/money/purchase.js`** (pure, no imports from UI):
   - `acquisitionTaxRatePct(priceWon)` returns the rate % (4-decimal rule above).
   - `purchaseCosts({ price_won, area_m2 })` returns `{ items, total_won, notes }`.
     - `items` is ordered: `acquisition_tax` (취득세), `education_tax` (지방교육세), `rural_tax` (농어촌특별세, only when > 0), `brokerage_cap` (중개보수 상한).
     - Each item is `{ key, label_ko, won, rate_pct, basis_ko, source_ko }`. `basis_ko` is the plain words, e.g. "집값 7억 5,000만 원 × 2%"; `source_ko` is the law name and article.
     - `notes` (Korean, plain): "1주택 기준이에요. 다주택 중과·생애최초 감면은 넣지 않았어요."; "중개보수는 서울시 조례의 상한이에요. 실제 금액은 중개사와 정하고, 부가세는 따로예요."; "등기 비용(국민주택채권·법무사)·인지세·이사비·재산세는 넣지 않았어요."; plus the 85 ㎡ line from rate 3 when needed.
   - Export the brokerage table and the source strings as constants so the UI (35b) can show them.
2. **`tenure.js` 매매 branch** (`:101-111`):
   - Accept `area_m2` in args.
   - `one_off = purchaseCosts({ price_won: price, area_m2 })`.
   - **Money order:** your cash pays the one-off costs first, then the price. `loan = max(0, price + one_off.total_won − cash)`. `upfront_won = price + one_off.total_won`. The monthly payment amortises `loan` as today.
   - `breakdown` becomes:
     ```
     { kind: "trade", price_won, one_off_items, one_off_total_won,
       cash_won, loan_won, own_money_won: min(cash, upfront),
       loan_rate_pct, loan_years, note }
     ```
     Keep `note` as today.
   - Replace `TRADE_TAX_NOTE` with `TRADE_COSTS_NOTE` = "취득세·지방교육세·중개보수 상한을 넣었어요. 등기 비용·인지세·이사비·재산세는 빠져 있어요." Keep `TRADE_TAX_NOTE` exported as an alias of the new text so `ui/money.jsx:24,307` keeps working. 35b will rework that UI.
   - Never judge whether the loan is possible (LTV·DSR). Add `loan_share_pct = round(loan ÷ price × 100)` to the breakdown, as a plain fact only.
3. **Callers pass the area:** `chat/custom-money.js:247` and `consult/tools-money.js:302` pass `area_m2` when they have it. In custom-money it is `areaM2` (`:229`); in tools-money, use the home's bucket area if it is in scope at that line, else omit.

## Tests — new `web/tests/purchase-costs-35a.test.js`, update `tests/money-tenure.test.js` only where it pinned the old 매매 numbers or `TRADE_TAX_NOTE` text
- **Tax rate:** 5억 → 1; 6억 → 1; 7.5억 → 2; 9억 → 3; 12억 → 3. 6억 5천 → 1.3333 (4 decimals).
- **Costs, 7억 5천만 at 84 ㎡:**
  - 취득세 15,000,000; 지방교육세 1,500,000; no 농특세;
  - 중개보수 상한 3,000,000 (0.4 %);
  - total 19,500,000.
- **Costs, 12억 at 101 ㎡:**
  - 취득세 36,000,000; 지방교육세 3,600,000; 농특세 2,400,000;
  - 중개보수 상한 7,200,000 (0.6 %).
- **Brokerage limits:** 1억 5천만 → min(750,000, 800,000) = 750,000; 4천만 → min(240,000, 250,000) = 240,000; 1억 9천만 → 800,000 (the limit).
- **Unknown area:** no `rural_tax` item, and the 85 ㎡ note is present.
- **tenureCost 매매**, price 9억, cash 3억, 84 ㎡, rate 4, 30 years:
  - one-off total = 27,000,000 + 2,700,000 + 4,500,000 (9억 falls in the "9억 to under 12억" brokerage band, 0.5 %);
  - loan = 900,000,000 + that total − 300,000,000;
  - monthly = `amortisedMonthly(loan, 4, 30)`;
  - `breakdown.one_off_items.length === 3`;
  - `loan_share_pct` is correct.
- **No change** for the 전세 / 월세 / 공공임대 cases already in `money-tenure.test.js`.

Run only:
```
cd web && node --test tests/purchase-costs-35a.test.js tests/money-tenure.test.js tests/worthit.test.js $(grep -lE "tenureCost|TRADE_TAX_NOTE|buildCustomMoneyDoc" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
UI files (`ui/**`), `src/i18n/**`, `src/engine/**`, `relay/**`, `data/`, `briefs/`, `README*`.

## Final message
Changed files, one line each. Nothing else.
