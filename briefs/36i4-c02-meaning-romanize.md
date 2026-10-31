# Stage 36i4 — the report's monthly line says what a buyer pays, and station names after an arrow are capitalised (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; the suite is green (2939). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (live English session, buying ₩700M or less, Pangyo)
1. **The report check says "Rent plus fees totaled 2,055,222 won" for a home the couple buys.**
   - In Korean the recorded run says `월세와 관리비를 더한 한 달 금액은 2,055,222원이었어요`.
   - Cause: `reportDigest` (`web/src/verify/compare.js:177-182`) gives C02 one fixed meaning for every Korean home:
     - `meaning_ko: "월세·관리비를 더한 한 달 금액"`;
     - `meaning_en: "rent plus maintenance for one month"`.
   - `engineValue("C02")` (`web/src/verify/numbers.js:118-125, 185-191`) sums `monthly_won + maintenance_won_month + utilities_won_month`. For a purchase `monthly_won` is the loan payment.
2. **`romanize("남한산성입구→모란")` returns `Namhansanseongipgu→moran`.**
   - The name after `→` is lower case, although `NAMES` has `모란: "Moran"` (`web/src/i18n/romanize.js`).
   - The screen shows `Line 8 Namhansanseongipgu→moran crowding 19% (Measured)`.

## Change
1. **C02 meaning by tenure** (`compare.js`).
   - Read the home's tenure from what `homes[label]` already carries. Look at how the caller builds `homes` (`grep -n "reportDigest(" src -r`) and use the field that is there (e.g. `tenure`). Do not add a new data path.
   - Meanings by tenure:
     - **trade (매매):** `대출 상환·관리비·공과금을 더한 한 달 금액` / `loan payment plus maintenance and utilities for one month`.
     - **jeonse:** `관리비·공과금을 더한 한 달 금액 (전세는 월세 없음)` / `maintenance and utilities for one month (jeonse has no rent)`.
     - **wolse / public:** today's text, with 공과금 added when utilities are in the sum: `월세·관리비·공과금을 더한 한 달 금액` / `rent plus maintenance and utilities for one month`.
     - **USD:** unchanged.
     - **Unknown tenure:** `집에 드는 한 달 금액 (관리비·공과금 포함)` / `monthly housing cost incl. maintenance and utilities`. Never 월세.
   - `scenarios/verify/ground_truth.json` C02 `label_ko` reads `월 주거비 총액 (월세·관리비·공과금)`. Make it `월 주거비 총액 (월세 또는 대출 상환·관리비·공과금)`, and keep `label_en`.
   - Add one line to `REPORT_PROMPT` (`web/src/consult/report.js`): `C02 문장은 values의 meaning_ko 말을 쓴다. 매매 집에 '월세'라고 쓰지 않는다.` Add the same rule to `REPORT_PROMPT_EN`: `For C02 use the words of meaning_en; never call a purchase "rent".`
2. **Romanize segments** (`romanize.js`).
   - Split on `→`, `·`, `/`, `-` (keep the separators).
   - Romanize each segment with the same rules, so a name from `NAMES` keeps its capital: `Namhansanseongipgu→Moran`.
   - Words that are not names keep today's output.

## Tests — new `web/tests/c02-meaning-36i4.test.js`
- `reportDigest` with a trade home (build the smallest input the existing C02 tests use; `grep -ln "meaning_ko\|monthly_total" tests/*.test.js`):
  - C02 `meaning_ko` contains `대출 상환` and not `월세`;
  - `meaning_en` contains `loan payment` and not `rent`.
- A jeonse home's meaning contains `전세는 월세 없음`. A wolse home's contains `월세`. USD is unchanged.
- `REPORT_PROMPT` contains `매매 집에 '월세'라고 쓰지 않는다`.
- `romanize("남한산성입구→모란") === "Namhansanseongipgu→Moran"`, and `romanize("석촌→복정")` has a capital after the arrow.
- **Keep green:** every test that mentions `reportDigest`, `meaning_ko`, `C02`, `romanize` or `REPORT_PROMPT`.

Run only:
```
cd web && node --test tests/c02-meaning-36i4.test.js $(grep -lE "reportDigest|meaning_ko|C02|romanize|REPORT_PROMPT" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/en*.js`, `relay/**`, `data/`, `pipeline/**`, `README*`, `public/recorded/**`, `src/main.js`, `src/ui/**`.

## Final message
Changed files, one line each. Nothing else.
