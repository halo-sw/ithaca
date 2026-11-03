# 49i: Two presentation-only polish fixes
Read AGENTS. Product code authored by Muse only. Do not explore, run git/build/full suite, or edit any engine, input, run, data or report logic. Two tiny changes only. No new tests for this low-impact display-only fix.

1. web/src/ui/life-plan.jsx lines 602–606: minutesLine currently interpolates raw JS sums, e.g. 143.39999999999998 min. Display finite numeric minutes to at most one decimal place, without forcing trailing .0. Preserve the partial label. Return null for nonfinite/non-number. Never mutate or round the stored source data. Keep the layout intact.
2. web/src/main.js lines 1993–1995: building hover is attached only to renderer.domElement pointermove; a tooltip persists after the cursor leaves the canvas for the header/sidebar. Add a pointerleave listener that hides hover20bEl. No camera or render changes. The hover DOM element is created at lines1929–1935 and has a style.display property; it can be hidden directly like the existing no-hit handler.

Stop after the two edits. Orchestrator will build and visually check these exact cases.
