# Stage 29N3g — the English diary never romanises activity words (brief for Muse)

Agent mode, rules in `AGENTS.md`. Branch `chat-27`. No sub-agents, no git, no todo list, no full test suite, no build. First edit within 3 tool calls. Stop when the named tests pass.

## Why (live, English UI, US run 124 University Avenue vs 515 Cleveland Street)
The Muse diary reads: "Evening **jangbogi (장보기)** and **gongwon (공원)** outings varied across the month", and a diary line "went to **gongwon (공원)** for 30 minutes". Muse romanises because the record digest it gets for the report/diary carries Korean activity and generic-place words (`장보기`, `공원`, `산책`, `공원/귀가` …). Likely sources (grep, read only what you need): `web/src/consult/guards.js:~646` (`장보기 …번, 산책 …번` digest lines), `web/src/consult/tools.js:~907` (`KIND_KO`), `web/src/engine/moments.js:~242` (`noun: "장보기"`), `slimRunForReport` in `web/src/verify/compare.js:~53`, and how an unnamed POI is labelled in records (`공원`). Same problem would hit an English Seoul run.

## Change
When the report/diary request is English (`lang === "en"`), every activity word and generic place label in the digest / record rows sent to Muse is English (`groceries`, `park`, `walk`, `park or home`, `convenience store`, `supermarket`, `clinic` …) from one table next to the existing glossary (`web/src/i18n/en-words.js` / `en-table.js`). Real proper names (`Main Street Market`, `선릉역` → handled by today's romanize rules) are untouched; only generic words change. Korean requests are byte-identical. Also add one line to the English report instruction (grep `ENGLISH_NOTE` in `web/src/consult/agent.js`): "Never romanise a Korean generic word (장보기, 공원); use the English word."

## Tests
New `web/tests/en-diary-words-29N3g.test.js`: the digest/record builder for `lang: "en"` on a fixture run with errands and an unnamed park contains `groceries` and `park` and no Hangul in those rows; `lang: "ko"` output is unchanged (compare to the current output for the same fixture); `ENGLISH_NOTE` contains the new line.
Keep green: `$(grep -l "slimRunForReport\|KIND_KO\|guards" tests/*.test.js)` and `tests/us-30d-polish-29N3d.test.js`; list any expectation you updated.

Run only:
```
cd web && node --test tests/en-diary-words-29N3g.test.js tests/us-30d-polish-29N3d.test.js $(grep -l "slimRunForReport\|KIND_KO\|guards" tests/*.test.js) 2>&1 | grep -E "^# (pass|fail)|not ok" | head -12
```
Do not touch `pipeline/`, `data/`, `relay/`, `briefs/`. Final message: changed files, one line each, plus updated expectations. Nothing else.
