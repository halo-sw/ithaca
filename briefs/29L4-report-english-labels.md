# Stage 29L4 — The English report names people and costs the way the customer sees them (brief for Muse)

Agent mode, rules in `AGENTS.md` (read the "Usage budget" section). Branch `chat-27`. Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Read only the line ranges named here. Stop when the named tests pass.

## Why
English live runs, 2026-11-01 (real Muse Spark 1.3, Meta HQ and Seoul newlyweds) pass on the first try, but read oddly:
```
Na averaged 11.5 minutes and spouse averaged 11.5 minutes one-way.     ← "나" romanised
Home A: me averaged 8.2 minutes and spouse averaged 8.2 minutes one way. ← lower-case "me", "Home A:" prefix under the Home A heading
One month rent plus fees totaled $4,261.                                 ← US figure is the Zillow ZIP rent only, no fees
1 records cited                                                           ← plural
```

## Changes
1. `web/src/verify/compare.js` `reportDigest` (N01 block, `~:156-172`): add `label_en` next to `label_ko` — `나` → `You`, `배우자` → `Your partner`, any other label → the label as is. `web/src/consult/report.js` `REPORT_PROMPT_EN`: "In English, call members by label_en (You, Your partner)."
2. C02 meaning by currency: `reportDigest` C02 values gain `meaning_ko`/`meaning_en`: KRW → `월세·관리비를 더한 한 달 금액` / `rent plus maintenance for one month`; USD → `ZIP 평균 월세(Zillow), 관리비 없음` / `typical monthly rent for the ZIP (Zillow), no fees`. Prompts (KO and EN): "C02는 values의 meaning을 따른다 / follow the C02 meaning in values". Replace the fixed C02 line in the item-meanings sentence accordingly.
3. `REPORT_PROMPT_EN`: "Sentences sit under their home's heading: never start with `Home A`/`Home B`."
4. `web/src/i18n/en.js:405` `{ ko: "근거 {0}개", en: "{0} records cited" }` → singular when {0} is 1: `1 record cited`, otherwise `{n} records cited` (use the plural mechanism en.js already has for other counts; grep `records\|{0}개` for the pattern; if none, add a function-valued `en` entry and support it where patterns are applied).

## Tests — extend `web/tests/report-members-29k1.test.js`
- digest N01 member `h1` with label 나 has `label_en: "You"`; 배우자 → `"Your partner"`.
- digest C02 for a USD home has `meaning_en` containing `no fees`; KRW has `maintenance`.
- `REPORT_PROMPT_EN` contains `label_en` and `never start with`.
- English translation of `근거 1개` is `1 record cited`, of `근거 3개` is `3 records cited`.

Run only:
```
cd web && node --test tests/report-members-29k1.test.js tests/submit-report-29j2.test.js tests/verify-compare-29j1.test.js $(ls tests/*i18n*.test.js 2>/dev/null) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```

## Do not touch
UI layout, map, 3D, `briefs/`.

## Final message
Changed files, one line each. Nothing else.
