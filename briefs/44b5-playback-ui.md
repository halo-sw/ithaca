# 44b5 — Expose slow speed in the actual timeline
Correction to 44b4: timeline items are hardcoded, not dynamically mapped.
In web/src/ui/timeline.jsx lines 347–351 and 373–377, both SegControl items arrays currently contain 1,10,60. Add `{ value: "0.1", label: "0.1×" }` as the first entry to BOTH arrays. No other code changes, no exploration. Keep sim.js SPEEDS as changed in44b4. Run only `node --test web/tests/timeline-13f2.test.js 2>&1 | tail -15`. Do not run build/git/full tests. Stop after that.
