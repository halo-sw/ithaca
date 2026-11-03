# 46h — Vite instrumentation URL correction

Edit only web/scripts/aerial-detail-audit.mjs, read this small file if needed. No product/git/build/full tests/browser. Node --check only. Two changes:

1. Vite can load /src/main.js?t=..., so page.route('**/src/main.js') misses it. Change to '**/src/main.js*', as the prior working QA script uses. Before/after replacement track whether MARKER matched, and put instrumentation result in logs (do not print source). Marker remains valid in curl: return { newline4spaces origin, cx, cy, span, renderer, renderCtl, rig, scene, camera, controls,. Ensure injection matches.
2. runCase currently catches only in main and throws away all case diagnostics before page closes. Add catch before its finally: save <case>-error.png screenshot best effort and <case>-error.json with error message+stack, collected errors/logs/requests, page.url, and brief readiness diagnostics (typeof window.__aerialAudit, store.getState()?.ready, body.innerText.slice(0,1000)). Then rethrow so nonzero remains. Finally still closes page/context. On failure do not logpassed.

No speculative changes. Code author Muse. Stop after syntaxcheck.
