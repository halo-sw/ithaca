# Stage 36i — an English buyer's first message reads right, both salaries count, and English mode never shows the Korean fallback (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`; the suite is green (2920). First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Found by the orchestrator (live Muse session, `?chat=&lang=en`, localhost)
The user typed:
> We are an engaged couple and we both work in Pangyo. Our salaries are ₩60M and ₩50M, and we have ₩200M saved. We want to buy a home of 50 m² or more for ₩700M or less.

What the app did:
- **Wrong price cap.** The situation card read `purchase ₩50M or less`, so there were 0 candidates. `extract_profile` (`web/src/profile.js`) gives `priceMax 50000000`, evidence `"50 m"`.
  - Cause: `findMoney`'s English regex (`profile.js:166`) matches `50 m` in `50 m²`. The `i` flag lets `m` stand for "million", and `\b` holds before `²`.
  - Then the `buy|purchase|price` anchor takes it, because it is within 24 characters of "buy".
- **No salary.** `salaryAnnual` stays null. The English anchor `/(?<!-)(?:salary|earn|make|income)(?!-)/i` (`profile.js:~516`) does not match "salaries".
- **Second salary dropped, in Korean too.** `판교로 출근하는 맞벌이 예비부부예요. 연봉은 6천, 5천이고 …` gives `salaryAnnual [60000000]`.
  - `moneyMembersFromProfile` (`web/src/chat/custom-money.js:141-150`) then uses `salaries[0]` for the partner.
  - So the partner earns ₩60M instead of ₩50M.
- **Korean fallback on the English screen.** After 6 tool rounds the reply showed:
  > 도구 호출이 6라운드를 넘었다. 도구 결과의 수치만 정리합니다 (가정값 포함): · 이번 대화의 도구 결과에 수치가 없어요…
  - Source: `web/src/consult/agent.js:667-679` and `numbersOnlyAnswer` (`web/src/consult/guards.js:617`).
  - `englishFallback` returned null, so the Korean text went out as is. The Korean line is also plain-form (반말) and reads like a log.

## Change
1. **Area is not money** (`findMoney`, `profile.js`).
   - A number directly followed by an area unit is never a money hit. Area units: `m²`, `m2`, `㎡`, `sqm`, `sq m`, `square met…`, `평`, `pyeong`.
   - Keep `300m won`, `300 million`, `₩300M` as money.
   - Lowest-touch way: after a regex match, skip it when the text right after the matched number+`m` continues with `²`, `2`, `\^2` or `\s*sq`.
2. **Salaries.**
   - **English anchor:** also matches `salaries`, `earns`, `earning`, `makes`.
   - **Korean anchor `연봉`:** unchanged.
   - **A list after one salary anchor** becomes one amount per member, in order. Examples: `연봉은 6천, 5천`, `연봉 6천이랑 5천`, `salaries are ₩60M and ₩50M`, `₩60M and ₩50M a year`.
     - The list is money hits joined only by `,`, `·`, `/`, `and`, `&`, `이랑`, `하고`, `과/와` (≤ 6 characters between).
     - All of those amounts are claimed, so none becomes the price, deposit or monthly cap.
   - **A second anchor for the partner** sets the second member's salary: `my partner earns ₩50M`, `배우자 연봉 5천`, `아내는 5천`.
   - **One amount for two people** keeps today's behaviour (`moneyMembersFromProfile` reuses `[0]`).
   - **Evidence:** the whole span (`6천, 5천` / `₩60M and ₩50M`).
3. **Fallback text** (`agent.js` round-limit branch and the guard branch, `numbersOnlyAnswer`).
   - **Korean wording (해요체):** replace `도구 호출이 N라운드를 넘었다.` with `확인할 게 많아서 여기서 멈췄어요.` Replace the header `도구 결과의 수치만 정리합니다 (가정값 포함):` with `도구가 낸 수치만 정리했어요 (가정값 포함):`.
   - **English mode (`isEnglish`):** when `englishFallback` returns null, reply with a fixed English text, never the Korean one.
     - `I checked a lot and stopped here. Numbers the tools returned (assumptions included):` followed by the same bullet values.
     - With no numbers: `I couldn't finish an answer this time. Try a narrower question, or widen the budget, size or area.`
   - **Shared:** give `numbersOnlyAnswer` an `{ lang }` option. The English bullets reuse the existing formatters, with English labels for the fixed words (회 → times, 그래프 → graph, 가정값 → assumed, 합계 → total, 매매 → purchase, 전세 → jeonse, 건 → deals, 실거래 → real deals).
   - **Do not** add new numbers.

## Tests — new `web/tests/english-intake-36i.test.js`
- **The English sentence above:**
  - `priceMax` 700000000 (evidence contains `₩700M`);
  - `sizeMin` 50;
  - `cash` 200000000;
  - `salaryAnnual` [60000000, 50000000];
  - `tenure` trade.
- **The Korean sentence** `판교로 출근하는 맞벌이 예비부부예요. 연봉은 6천, 5천이고 모은 돈은 2억이에요. 7억 이하로 50㎡ 이상 집을 사고 싶어요.`:
  - `salaryAnnual` [60000000, 50000000];
  - `priceMax` 700000000;
  - `cash` 200000000;
  - `sizeMin` 50.
- **Partner sentence:** `My salary is ₩60M and my partner earns ₩50M. We have ₩200M saved and want to buy a 50 sqm home under ₩700M.` gives [60000000, 50000000] and price 700000000.
- **Area only:** `a 59 m2 flat, budget ₩600M` gives price 600000000. `84 m² under 900M won` gives 900000000. No hit equals 59000000 or 84000000.
- **Single salary:** `연봉 4천, 모은 돈 1억, 4억 이하 집 사고 싶어` gives `salaryAnnual` [40000000], price 400000000.
- **`moneyMembersFromProfile`** with salaries [60M, 50M] and two members gives `annual_salary_won` 60000000 / 50000000.
- **Fallback:**
  - `numbersOnlyAnswer([], { lang: "en" })` has no Hangul.
  - The Korean default has no `넘었다` and no `합니다`.
  - Assert by source or a pure helper that `agent.js` has no `라운드를 넘었다`.
- **Keep green:** every test file matching `profile|extract_profile|intake|custom-money|numbersOnlyAnswer|agent-` (see the command).

Run only:
```
cd web && node --test tests/english-intake-36i.test.js $(grep -lE "extract_profile|numbersOnlyAnswer|moneyMembersFromProfile|라운드" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -20
```
If anything still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/i18n/**` (the orchestrator adds English rows), `relay/**`, `data/`, `pipeline/**`, `README*`, `scenarios/`, `public/recorded/**`, `src/main.js`, `src/ui/**`.

## Final message
Changed files, one line each. Nothing else.
