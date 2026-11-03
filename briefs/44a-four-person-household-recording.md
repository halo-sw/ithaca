# 44a — explicit four-person family, for a truthful separate recording

Follow AGENTS.md. Muse authors product code/tests. One narrow change; no subagents, no git, no full suite/build, no result notes. Other edits are active in web/src/ui/chat.jsx and web/src/i18n/en.js: DO NOT TOUCH THEM. No network tools. Do not read large files except the ranges below. Stop after implementation and named tests.

## Evidence and exact scope

The presentation needs a separate real example: two working parents and two elementary-school children. The current extraction creates only one child, and scenario conversion never enables the school routine. Do not invent school assignments, quality, escort coordination, incomes or routes.

Read only:
- `web/src/profile.js:237-330` findMembers.
- `web/src/profile.js:1260-1345` member label helpers.
- `web/src/profile.js:1438-1465` scenario member mapping.
- `web/tests/profile-english-24b.test.js:1-70` compatibility expectation.
- `web/tests/households-39a.test.js:1-65` extraction/scenario fixture patterns.
- `web/tests/engine-fixture.js:1-135` synthetic engine fixture, only if necessary for the new integration test.

## Change (only profile.js, new tests/four-person-44a.test.js, and necessary existing English test expectations)

1. findMembers: recognize explicit child counts, including `자녀 두 명`, `자녀 2명`, `아이 둘`, `two elementary-school children`, `two children`, and `2 children`. Preserve count evidence as verbatim substrings. Do not infer family composition from `family of four` alone. Recognize `two working parents` as two adults when explicit. Do not count the `두 명` in a child count as two adults: `혼자 아이 두 명을 키워요` must remain one adult plus two children. Preserve existing couple, one-child and senior behavior.
2. Mark children with `school: true` only when explicitly described as attending school / elementary school (Korean 초등학생/초등학교, English elementary/primary-school/school-age). Do not send babies/toddlers to school just because role=child. Use only stated evidence. Unknown age remains unassigned.
3. scenarioFromProfile child branch: carry `school: m.school === true` into scenario. Add a short comment: nearest school is a route proxy, not an enrollment assignment. Preserve schooldays and work:none. Do not modify routine engine.
4. Multiple children need distinct generated labels in the scenario: `아이 1`, `아이 2`; explicit user labels win. Keep the single-child label unchanged. Add corresponding reversible `Your child 1`/`Your child 2` translations in memberLabelEn/memberLabelKo. Do not touch UI/i18n files.

## Meaningful tests

New tests prove:
- KO `맞벌이 부부와 초등학생 자녀 두 명인 4인 가족입니다. 판교로 출근합니다.` produces 2 adults + 2 children; guardProfileValues has no errors; child school flags true.
- EN `We are a family of four: two working parents and two elementary-school children. We work in Pangyo.` same counts, verbatim evidence, school true.
- `I live alone with two children.` and `혼자 아이 두 명을 키워요` remain 1 adult + 2 children.
- A couple with a toddler/baby does not gain a school routine.
- scenarioFromProfile + parseScenario retain both child school flags and distinct labels. If using tinyArea/tinyScenario, simulate 30 days with two children and assert each child's school trips exist with no invented result figures.
- Existing one-child English test retains its meaning; update only expected explicit school field where justified.

Run only: `node --test web/tests/four-person-44a.test.js web/tests/profile-english-24b.test.js web/tests/households-39a.test.js web/tests/households-38e.test.js 2>&1 | tail -18`.
If still failing after two fixes, stop and print failure tail. Final response: changed files, one line each.
