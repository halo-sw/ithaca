# Stage 41l — Korean sentences: workplace and salaries read right; pins say "출근" only for a real commute (brief for Muse)

Agent mode, rules in `AGENTS.md`. No sub-agents, no git, no todo list. First edit in your first tool call. Do not edit `web/src/i18n/*`.

## Why (production copy, 2026-11-02, Korean UI, both Muse Spark 1.3 and Spark Open)
The owner's demo sentence in Korean:
`판교에서 둘 다 일하는 예비부부예요. 연봉은 6천만 원, 5천만 원이고 모은 돈은 2억 원이에요. 7억 원 이하로 50㎡ 이상 집을 사고 싶어요.`
`extract_profile` (`web/src/profile.js`) returns:
- `workplaces: null` (asked) — so the header has no "판교 출근", the map asks "회사 위치를 알려 주세요", and the 30-day button never appears. The model even says "판교 근무 기준" while the profile has no workplace.
- `salaryAnnual: [200000000]` with evidence "2억" — the savings were taken as the salary; 6천만 원 and 5천만 원 were dropped.
The English sentence (`We are an engaged couple, both working in Pangyo. Salaries 60M and 50M won, 200M won saved. …`) gets the workplace, but `salaryAnnual: [60000000, 50000000, 200000000]` — the savings leak into the salary list there too.
And with no workplace, every map pin says `출근 1분` / `출근 0분` (`web/src/chatmap.js:632`, `web/src/ui/chatmap.jsx:141`): those minutes are the walk to the nearest station, not a commute.

## Change
1. Workplace (Korean): `…에서 (둘 다|같이|함께)? 일하는/일해요/근무하는/근무해요/다니는`, `…로/으로 (둘 다)? 출근하는/출근해요`, `직장은 …`, `회사는 …` → the place before the particle is the workplace. `둘 다 / 같이 / 함께 / both` with one place = the same workplace for every working member. Keep 39a's person-word logic (남편은 강남, 저는 판교) unchanged.
2. Salaries: money after `연봉/월급/세전/salary/salaries/earn/make` (and money listed right after it with `,` / `and` / `이랑` / `하고`) is salary. Money tied to `모은 돈/저축/현금/자기 자본/saved/savings/cash/in the bank` is `cash` only, never salary — in both languages.
3. Pins: the `출근 N분` / `N min` label shows only when the minutes are a door-to-door commute to a known workplace. Without a workplace, show the station walk as `역까지 걸어서 N분` (en: `N min walk to station`) or nothing — never "출근". Same for the map legend lines at `ui/chatmap.jsx:111-116`: "출근 시간" only when a workplace exists.

## Tests — new `web/tests/korean-profile-41l.test.js`
- The Korean sentence above → workplaces `[{ text: "판교", … }]` (both members, or member 0 with the shared rule), salaryAnnual `[60000000, 50000000]`, cash `200000000`, priceMax `700000000`, sizeMin 50.
- The English sentence → salaryAnnual `[60000000, 50000000]`, cash `200000000`.
- `둘 다 판교로 출근하는 부부예요`, `판교에서 근무해요`, `직장은 판교예요` → workplace 판교.
- 39a cases still pass (`남편은 강남, 저는 판교에서 일해요` → two workplaces).
- Pin label with no workplace contains no "출근"; with a workplace it still shows `출근 N분`.
Run the new file, the profile/chatmap tests, then once the full suite: `cd web && node --test tests/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" | head -20`.

## Final message
Cause in one sentence each (workplace, salary, pin), changed files one line each, suite line.
