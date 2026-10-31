# Stage 35c — buying (매매) is the default everywhere a Korean search starts (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section) and `web/AGENTS.md`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. Branch `ithaca-17`. Stage 35a (purchase one-off costs in `money/purchase.js`, `tenureCost` 매매) is in the tree. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
The customer decided (2026-11-01) that Ithaca works from **buying a home (매매)**. "전세 is too special a case."
- Every Korean starting point now says and searches 매매.
- 전세 and 월세 stay available when the customer asks for them.
- The US stays rent-only: its data is the Zillow ZIP rent, so `profile.js:574-583` keeps forcing `wolse` for USD.

## Change
1. **Profile default** (`web/src/profile.js`):
   - **Set the default.** In the intake merge, right after `:584-586`, add the case where the profile is KRW (not USD), `tenure.value` is still null and the text named no tenure. Set it with `field("trade", "default", "기본: 매매(집 사기)")`. A tenure the customer says later still wins: replace a `"default"`-sourced tenure when a tenure word arrives.
   - **Ask about money.** In `missingQuestions` (`:680-696`), when the tenure is missing or `trade`, ask nothing about tenure. Instead:
     - when `priceMax` is null, ask `{ field: "priceMax", ask: "집값은 얼마까지 보세요? (예: 9억 이하)" }`;
     - when `cash` is null, ask `{ field: "cash", ask: "집 사는 데 쓸 수 있는 모은 돈은 얼마예요? (대출 계산에 써요)" }`.
     - The existing 전세 / 월세 / 공공임대 branches stay as they are.
   - **Example profile.** In `exampleProfile` (`:1000-1024`):
     - `tenure` = `field("trade", "customer", "예시: 매매")`;
     - `priceMax` = `field(900000000, "customer", "예시: 9억 이하")`;
     - `cash` = `field(300000000, "customer", "예시: 모은 돈 3억")`;
     - `depositMax` = `field(null, "asked", "")`.
2. **Starting prompts → 매매** (each still parses into a full profile):
   - `ui/landing.jsx:25-37` `EXAMPLE_PROMPTS`:
     - single-firstjob: `"판교로 출근하는 신입, 연봉 4천, 모은 돈 1억, 4억 이하 매매"`;
     - newlywed-couple: `"맞벌이 예비부부, 강남 출근, 모은 돈 3억, 9억 이하 매매"`;
     - dual-income-child: `"맞벌이에 초등학생 아이 1명, 잠실 출근, 모은 돈 5억, 15억 이하 매매, 초등학교 도보 10분"`;
     - leave `us-meta` alone.
   - `ui/landing-page.jsx:16-19`:
     - `HERO_PLACEHOLDER = "판교 출근, 모은 돈 1억, 4억 이하 매매로 혼자 살 집 찾아 줘"`;
     - `COMPOSER_FILL = "판교로 출근해요. 혼자 살 집을 매매로 찾아 줘"`;
     - `HOOD_PROMPT = "미금역 근처 매매 찾아 주고 동네를 보여 줘"`.
   - `ui/landing-page.jsx:68-69` `USE_CASES[0].line` = `"미금역 7분, 매매 실거래로 좁혀요"`.
   - `ui/chat.jsx:3446` `EMPTY_FIND_TEXT` = the same text as `HERO_PLACEHOLDER`.
3. **Persona templates** (`scenarios/personas/{single-firstjob,newlywed-couple,dual-income-child}.json`, the `tenure` blocks at `:70`, `:110`, `:131`): make their tenure 매매 / `trade`, with the same price caps and cash as item 1's example prompts. Keep each file's existing field shapes and labels (`가정값`).
4. **Map filter** (`ui/map-filters.js:14`): `FILTER_TENURES = ["trade", "jeonse", "wolse"]`, so 매매 is the first option.
5. **Muse's instructions** (`consult/agent.js`). Add one sentence after line 75:
   > "기본은 집을 사는 경우(매매)다. 고객이 전세·월세·공공임대를 말하지 않으면 매매로 찾고, 집값 상한과 집 사는 데 쓸 모은 돈을 묻는다. 매매 결과의 돈은 '살 때 한 번에 내는 돈(집값 중 내 돈·취득세·지방교육세·중개보수 상한)'과 '매달 내는 돈(대출 갚는 돈·관리비)'으로 나눠 말하고, 대출을 받을 수 있는지는 판단하지 않는다."
   - In line 86, change the example `'전세로 살면 매달 집에 드는 돈'` to `'집을 사면 매달 집에 드는 돈(대출 갚는 돈과 관리비)'`.
   - Give the English prompt the same rule (`REPORT`/`AGENT_PROMPT_EN` or wherever agent.js builds the English system text; grep `"en"` near the prompt assembly).

## Tests — new `web/tests/buying-default-35c.test.js`
- **Default tenure:** parsing "강남 출근, 모은 돈 3억, 9억 이하 매매" gives tenure `trade`, `priceMax` 900,000,000 and `cash` 300,000,000.
  - "강남 출근 둘이" (no tenure word) gives tenure `trade` with source `default`.
  - "전세 4억 이하" still gives `jeonse` with `depositMax` 400,000,000.
  - "I work at Meta HQ, renting up to $5,000" still gives `wolse` / USD.
- **Questions:** `missingQuestions` for a KRW profile with no tenure asks `priceMax` and `cash`, and never asks `tenure`.
- **Example prompts:** every `EXAMPLE_PROMPTS` entry except us-meta parses to `trade`, with a `priceMax`.
- **Filter:** `FILTER_TENURES[0] === "trade"`.
- **Agent prompt:** the Korean and English agent instructions contain the 매매 default rule.
- **Old tests:** update existing tests only where they pinned the old example prompt text or the old jeonse default. Name each one in the final message. Parser tests that feed their own "전세 …" text must still pass unchanged.

Run only:
```
cd web && node --test tests/buying-default-35c.test.js $(grep -lE "EXAMPLE_PROMPTS|HERO_PLACEHOLDER|EMPTY_FIND_TEXT|missingQuestions|exampleProfile|FILTER_TENURES|personas/|AGENT_PROMPT|systemPrompt" tests/*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head -15
```
If it still fails after 2 fix attempts, stop and print the last lines.

## Do not touch
`src/money/**` (35a), `src/i18n/**` (the orchestrator adds the English strings), `src/engine/**`, `relay/**`, `data/`, `README*`.

## Final message
Changed files, one line each. Old tests you changed, with why. Nothing else.
