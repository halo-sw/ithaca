# 49f: Point recorded-month entry to the new exact saved run
Read AGENTS. Three small source edits only. No exploration, git, build, full suite, new tests or subagents.

The orchestrator is exporting the actual, reviewed Muse month as web/public/recorded/pangyo-reviewed-month.json with its exact runBundle. Do not read or edit that large data file. Older records remain supported but are not the default.

1. web/src/chat/recording.js top: export DEFAULT_RECORDING_ID = "pangyo-reviewed-month"; prepend a RECORDINGS entry with id that constant, title "검토한 생활 계획 · 판교 커플의 30일 (영어 녹화)", titleEn "Reviewed routines · a Pangyo couple's 30 days". Preserve old entries and strict validation unchanged.
2. web/src/ui/landing-page.jsx top imports: import DEFAULT_RECORDING_ID from ../chat/recording.js. replayIdForLang currently returns en?menlo-month:seoul-couple. It should return DEFAULT_RECORDING_ID for either language. replayEntryUrl must still preserve the requested language.
3. web/src/ui/chat.jsx import recording functions around line118: add DEFAULT_RECORDING_ID. replayIdForChat currently returns the locale-based old IDs (around 5100 after latest edits); return DEFAULT_RECORDING_ID. Empty hero entryDeps.openReplay currently constructs old language-based IDs (around 5990); use DEFAULT_RECORDING_ID and preserve language in URL. Do not edit active replay IDs passed in the URL or the old records.

No new behavior besides which record opens. No new tests needed for these links. Run existing replay-integrity-47n.test.js and judge-path-29a6.test.js with compact output, then stop.
