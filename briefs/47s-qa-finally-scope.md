# 47s — one QA scope fix

Muse only. Edit only web/scripts/life-plan-audit.mjs. No browser/full suite/git. Read lines 250–285, 420–434 and `result.trace` references. 47p2 added `trace.filter` in finally but trace is try-block-scoped. Browser run reaches finally and throws ReferenceError. Use the existing result.trace array (assigned at fixture installation) in finally, safe on early exceptions. Keep all assertions, days===30, expected error classification. No product edits. Run node --check. Stop after fix; do not explore.
