# 49j: Saved Muse provenance must survive playback
Read AGENTS. Product code/tests by Muse only. This is display provenance, not a new simulation. Do not change records, routing, model calls, report validation or rules. No exploration/git/build/full suite.

Read only these ranges:
- web/src/sim.js 200-225 (decisionBadge) and web/tests/sim.test.js 110-150
- web/src/main.js 30-42 (imports),1458-1479 (judgedView/badgeFor),2530-2549 (caption),2598-2612 (live caption),2620-2640 (log). currentLang is already imported at line34.
- web/src/ui/app.jsx 809-832 (howCalculatedLines)
- web/tests/results-18.test.js 1-35,80-108 (JSX loader and provenance tests).

Fix three verified display bugs:
1. main badgeFor currently uses judgeExtras presence to decide recorded Muse on STATIC_SITE. A saved custom live run has chosen_by=model/provider meta or baseten, but no judgeExtras, so falsely shows Rule-based judgment. Judge the already-resolved v provenance itself: model => recorded Muse (retain provider-specific cls); rule_fallback => an explicit fallback label; rule => rule. Nonstatic decisionBadge remains compatible. Prefer small exported helper playbackDecisionBadge(d, staticSite) in sim.js and wrapper in main so we can regression test pure behavior. Use existing Korean strings for recorded/rule; explicit English 'Rule fallback' acceptable if no existing translation. Preserve baseten vs spark cls. Matching overlay is already resolved by judgedView. Never imply a fresh model call during replay.
2. Caption and judgeLog reason use reason_ko even with English UI. Prefer reason_en when currentLang()==='en', otherwise reason_ko; fallback to the other only when missing. Apply also live-caption if present. Do not romanize saved English or alter stored data. Small pure helper allowed for tests.
3. howCalculatedLines uses only judgment.a/b but actual custom run returns judgment.A/B. Support A??a and B??b, not sum both. Count model only, not rule_fallback. Keep legacy tests/copy compatible; no other arithmetic changes.

Meaningful tests in existing sim.test.js/results-18.test.js: static saved model absent overlay remains recorded; baseten cls retained; rule fallback explicit; plain rule not labelled Muse; capital A70model/B63model+2rule_fallback => A70/B63, no zero claim; legacy lowercase still works; uppercase takes precedence if both shapes. Test English reason preference if extracted helper. Run ONLY these two test files, tail15. Stop after edits/tests, report filenames and result.
