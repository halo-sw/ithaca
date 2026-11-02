# Stage 41a — English money format, chip captures, lot names (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list, no full suite. First edit in your first tool call. Parallel runs 41b (consult/*, verify/compare.js) and 41c (profile.js, ui/money.jsx, ui/candidate-card.jsx) are running: touch only `web/src/i18n/translate.js`, `web/src/i18n/romanize.js` and tests.

## Why (English audit on the live site, 2026-11-01)
`createTranslator` (built like `web/src/i18n/index.js`) gives today:
- "전세 1.7억" → "deposit lease 1.₩700M" (decimal 억 is split at the dot).
- "필요 1,000만 원 · 가진 돈 0원" → "… you have 0won"; "출퇴근 88번 × 1,500원" → "commute 88 times × 1,500won".
- "주거비 월 10만 원" → "… ₩0.1M"; "15만 원" → "₩0.2M" (rounded, and wrong: 150,000 is not 0.2M).
- The edit-conditions aria-label "조건 수정: 디지털미디어시티 출근 · 1인 · 주 3일 출근 · 전세 3억 원 이하" still reads "… Ju 3 days commute …": the 39d " · " segment split never runs on a pattern capture.
- Home names: "가락동 훼미리 오피스텔2차" → "Garak-dong Family Officetel 2cha"; "휴먼시아41단지" → "Humansia41danji"; "빌딩-에벤에셀" → "Building -Ebenesel".

## Changes
1. English money format, decided by the owner (2026-11-01): **full digits and the word "won", never ₩ abbreviations, never M/K.** Korean won amounts in English read "170,000,000 won", "1,040,000 won", "35,000 won", "1,500 won", "0 won". This replaces every "₩…M"/"₩…K"/"₩1,500"/"…won" output of `translate.js` `localizeNumbers` (억/만/천/원 rules) and of any English money formatter for Korean won the translator path uses. Cases from the audit:
   - "전세 1.7억" → "deposit lease 170,000,000 won" (today "1.₩700M").
   - "전세 2억 6,000만 원" → "deposit lease 260,000,000 won"; "1억 2천" → "120,000,000 won" (only where it is money today).
   - "필요 1,000만 원 · 가진 돈 0원" → "Needed 10,000,000 won · you have 0 won".
   - "출퇴근 88번 × 1,500원" → "commute 88 times × 1,500 won"; "15만 원" → "150,000 won"; "3만 5,000원" → "35,000 won"; "104만 원" → "1,040,000 won".
   - Map pins / chips that build their English price through the translator get the same full form (long is accepted).
   US dollars ("$4,261/mo") are untouched. Korean output is untouched.
2. `translate.js`: a pattern capture that contains " · " is translated with the same segment split as a whole string (so the aria-label above ends "… office 3 days a week · deposit lease ₩300M or less").
3. `romanize.js` name rules: a trailing "N차" (digits + 차) reads " Phase N" ("…오피스텔2차" → "… Officetel Phase 2"); a trailing "N단지" reads " Complex N" ("휴먼시아41단지" → "Humansia Complex 41"); a hyphen between Hangul parts keeps no space on either side ("빌딩-에벤에셀" → "Building-Ebenesel").
4. Old pins: the English word for 전세 is now "deposit lease" (orchestrator data change in en-words/en.js/en-table), and every English won amount is now full digits + " won". Update the pins that assert the old word or the old ₩M/₩K form — first these three: `tests/eok-space-26q.test.js` ("full translator has no glued romanized 이하"), `tests/i18n-24c.test.js` ("joined persona label reads as words", "eok + man money localizes through the word path").

## Tests — new `web/tests/english-money-41a.test.js`
Every input/output above, plus "$4,261/mo" unchanged and no output anywhere in the test inputs contains "₩" followed by a digit and M/K.

Run only:
```
cd web && node --test tests/english-money-41a.test.js $(grep -l '₩[0-9.,]*[MK]' tests/*.test.js | tr '\n' ' ') tests/eok-space-26q.test.js tests/i18n-24c.test.js tests/english-leftovers-39d.test.js tests/english-names-39c.test.js tests/english-trust-29a1.test.js 2>&1 | grep -E "^# (pass|fail)|not ok" | head
```
List every pin you changed (old → new). If more than ~40 pins move, change them all the same way (mechanical) and say how many.

## Final message
Changed files, one line each, plus pins changed.
