# Stage 41b — Muse's English answers: no Korean, no romanized names, no "jeonse" (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Parallel runs 41a (i18n/translate.js, romanize.js) and 41c (profile.js, ui/money.jsx, ui/candidate-card.jsx) are running: touch only `web/src/consult/*.js`, `web/src/verify/compare.js` and tests.

## Why (English audit on the live site, 2026-11-01)
English answers read like this:
- "…within 60 minutes of Digital Media City Stn (디지털미디어시티역) …", "near Sangwangsimni Stn (상왕십리역)" — Korean in parentheses everywhere (`ENGLISH_NOTE`, `web/src/consult/agent.js:24`, tells the model to add it).
- Home names differ from the card: the answer says "Dongin Levante Opisutel", "Pangyo Yeok Geuncheo Opiseteul", "Gangnamgucheongyeok SK Hub Blue", "Gangnamyeok Senteureol Pureujio Siti"; the card says "Dongin Levant Officetel", "Officetel near Pangyo Stn (647)", "Gangnam-gu Office Stn SK Hub Blue", "Gangnam Stn Central Prugio City". The answer names come from the extra LLM naming call (`ensureHomeNamesEn`, 29M1); the card uses `homeNameEn`/`romanizeName` (`web/src/i18n/home-names.js`, `romanize.js`).
- "I found 5,630 jeonse homes …", "Maintenance for one month was 383,334 won, jeonse has no rent." (`web/src/verify/compare.js:215`), "Loan payment plus maintenance for one month was 150,000원."
- A tool error surfaced: `no complex named "강남구청역 에스케이 허브 블루" in st-강남구청` — the model passed the name with spaces; the stored name is "강남구청역에스케이허브블루".

## Changes
1. `ENGLISH_NOTE` (agent.js:24): replace the romanize-with-Korean rule with: never write Korean characters in an English answer; Korean station names are written as the tools give them in English (e.g. "Gangnam Stn"); a home is always called by its `name_en`, exactly. Tenure words in English: "deposit lease" (전세), "monthly rent" (월세), "buy" (매매), "public rental"; never write "jeonse" or "wolse". Money: Korean won always as full digits and the word won, e.g. "260,000,000 won" (replace the current ₩260,000,000 / ₩260M wording); US dollars as given. Public rental is removed from the service (41d): drop it from the note's tenure list. Keep the rest of the note. The customer may still type "jeonse"; that is fine.
2. English sessions: `name_en` for a Korean home is `homeNameEn(name)` from `web/src/i18n/home-names.js` (deterministic, same as the card). Seed `namesEn` with it for every Korean name the tool results carry before any naming call; the LLM naming call (29M1) may only fill a name whose `homeNameEn` is empty. Station names in tool results for English sessions: add `station_en` next to each Korean station field the model reads (use `romanizeName(station + "역")`).
3. Deterministic English answer cleanup (the existing English guard path in `web/src/consult/guards.js`, or the place the final English text is assembled): remove any parenthetical whose content contains Hangul (" (디지털미디어시티역)" → ""), replace any remaining Korean home name that has a known `name_en` with it, replace the words "jeonse"/"Jeonse" with "deposit lease"/"Deposit lease" and "wolse" with "monthly rent", and write Korean won as full digits + " won": "150,000원" → "150,000 won", "₩260,000,000" / "₩260M" → "260,000,000 won" (owner decision: never ₩ abbreviations, never M/K for won). Korean answers are untouched.
4. `web/src/verify/compare.js:206-232`: English meanings say "(a deposit lease has no rent)"; English amounts in report lines are full digits + " won" ("383,334 won"), never "원", never ₩M/₩K.
5. Complex-name lookups that fail with "no complex named" (`tools.js:496,1157`, `tools-money.js:214`): before failing, retry the match ignoring spaces (and "·"), so "강남구청역 에스케이 허브 블루" finds "강남구청역에스케이허브블루".

6. Numbers the model reads: the buy-vs-rent / ride-time tool rows produced "963.5999999999996 minutes at home B" in an English answer. Round every minute value in consult tool results to one decimal (or whole minutes where the field is already whole) before the model sees it; never emit float noise. Also "the average one-way commute is 5 at …" lost its unit — the answer cleanup adds " min" after a bare commute number only when the tool row says minutes (skip if unsure).

## Tests — new `web/tests/english-answers-41b.test.js`
- ENGLISH_NOTE has no "Korean once in parentheses" rule and names "deposit lease".
- The cleanup function: "near Sangwangsimni Stn (상왕십리역) at 24 min" → "near Sangwangsimni Stn at 24 min"; "5,630 jeonse homes" → "5,630 deposit lease homes"; "was 150,000원." → "was 150,000 won."; "₩260M" → "260,000,000 won"; a Korean answer is returned unchanged.
- English `name_en` for "강남구청역에스케이허브블루" equals `homeNameEn` of the same name, without any naming call.
- A complex lookup with "강남구청역 에스케이 허브 블루" against a fixture area holding "강남구청역에스케이허브블루" succeeds.
- A ride-time tool result of 963.5999999999996 reaches the model as 963.6.
- compare.js English meaning for a deposit lease contains "deposit lease" and no "jeonse".

Run only:
```
cd web && node --test tests/english-answers-41b.test.js $(ls tests/*consult*.test.js tests/*guard*.test.js tests/*compare*.test.js tests/*29M1*.test.js 2>/dev/null | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
List old pins you changed (old → new).

## Final message
Changed files, one line each, plus pins changed.
