# Stage 42a2 — after-run lines: right Korean particles, no double 월, no empty "자세히" bubble, English lines (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (42a local check, blocked second session, Korean UI)
Thread text after the run and the three chips:
```
다 살아 봤어요. A 판교 효성 해링턴 타워는 출근 편도 평균 7분, B 백궁 동양파라곤는 7분이었어요. 일기는 이번에 못 썼어요.
A 판교 효성 해링턴 타워은 출근 편도 평균 7분, B 백궁 동양파라곤은 7분이에요. 오른쪽에서 A 출근길을 보여 드려요.
A 판교 효성 해링턴 타워 동네를 오른쪽에 열었어요.
자세히
A 판교 효성 해링턴 타워 합계 월 월 165만 3,811 원, B 백궁 동양파라곤 합계 월 월 219만 1,622 원이에요.
```
1. Particles are fixed strings: `타워은`, `동양파라곤는` are wrong (`afterRunChipReply`, `diaryFallbackLine` at `web/src/ui/chat.jsx:442`).
2. `합계 월 월 …`: `moneyLineFor` writes `월` and `fmtWon(…, { monthly: true })` adds another.
3. `한 달에 얼마 들어?` leaves a bubble that says only `자세히` before the money line.
4. These lines are Korean only; on the English page they must come out in English (like `diaryFallbackLine(…, lang)` does, with `homeNameEn` for Korean names).

## Change
1. One small helper (e.g. `topicParticle(name)` → `은`/`는` from the last Hangul syllable's final consonant; last char not Hangul (digit, Latin, bracket) → the particle is not knowable, so those names use a no-particle form such as `A {name}: 출근 편도 평균 7분`). Apply it to every `{name}은/는` in `afterRunChipReply` and `diaryFallbackLine`, and `와/과` the same way where a name precedes it.
2. Money line: one `월` only — `월 주거비는 A {name} 165만 3,811 원, B {name} 219만 1,622 원이에요.` (amount from the same `monthlyHousingOf` value; no `합계 월 월`).
3. `한 달에 얼마 들어?` path: no bubble whose only text is `자세히`; the turn shows the money line (and the opened money tab on the right) only.
4. `afterRunChipReply(text, { …, lang })`: on `lang === "en"` return English lines, names via `homeNameEn` when Korean:
   - commute: `Average one-way commute: A {name} {N} min, B {name} {N} min. Showing A's commute on the right.`
   - tour: `Opened A {name}'s neighborhood on the right.`
   - money: `Monthly housing cost: A {name} {amount}, B {name} {amount}.`
   - no run: `First save two homes and run the 30-day stay.`
   - money tab only: `See the Money tab for the details.`
   - no commute run: `This stay had no commute. Showing a day at A {name} on the right.`
   Also the running stage line on the English page: `Living 30 days in A·B`.

## Tests — extend `web/tests/stage-run-42a.test.js`
- `해링턴 타워` → `는`, `동양파라곤` → `은`, `푸르지오시티` → `는`, `래미안` → `은`; name ending in a digit/Latin → no particle form.
- `diaryFallbackLine` and the commute chip line contain no `타워은` / `파라곤는` for those names.
- Money line has exactly one `월 ` before each amount… i.e. no `월 월`.
- `한 달에 얼마 들어?` on a done run adds no message whose text is just `자세히`.
- English: each chip's line with `lang: "en"` has no Hangul when names are given in Korean.
Run the file, chat tests, the full suite once (`cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`), and `npx vite build` once.

## Final message
Changed files one line each, suite line, build line.
