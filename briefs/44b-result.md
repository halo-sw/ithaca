# 44a–44b — live household decisions and four-person recording support

Product implementation and tests authored by Muse Code (Muse Spark 1.3); orchestration, capture, source audit and validation by Codex. Local implementation, not yet deployed.

The Chat “Live 30 days” action now runs the browser-safe household decision loop. Each household branch posts its bounded context to the authenticated consult proxy. Muse chooses from engine-provided options; the existing guard validates the reply, and the engine applies it. Final runs, report inputs and 3D playback share the same saved records. Background residents remain rule-based. Explicit guard fallbacks retain their provenance; a provider outage stops the live run.

The product shows live decision progress, per-home model/fallback counts and actual decisions linked to their recorded moments. The worker uses an inactivity timeout and sends no keys. The relay keeps existing session ownership/chat limits; decision requests have separate bounded budgets because a 30-day run needs many calls.

Explicit two-parent/two-schoolchild extraction now retains four members, distinct child labels and stated school participation. Nearest-school travel is a route proxy, not an enrollment assignment. Missing commute dependencies are loaded once; unresolved ride minutes stop a run rather than presenting a misleading zero.

Validation (2026-11-03):
- Full JS suite: 3,471 tests, 3,468 passed, 3 skipped, zero failures.
- Twenty new live-choice tests passed: alternative choice changes actual travel; deterministic replay; household/background provenance; worker request exchange, inactivity timeout and errors; guarded endpoint/BYOK/redaction; bounded relay budgets/session rejection.
- Production bundle built successfully. Existing >500KB chunk warning remains.
- `git diff --check` clean.
- A live development-server decision returned `chosen_by:model`, Muse Spark1.3, a guarded shop choice and its reason. This smoke call is separate from presentation runs.

Astryx doctor was also run on an exact copy of the production source (excluding test files): 19 passed, zero failures, three warnings. Warnings concern external font verification and existing legacy styles/components. The earlier build-folder audit falsely treated six test files' string literals as neutral-theme imports. No test files or application source were changed to suppress the check. Logs are kept with the video work files.

Recording results belong in the final video evidence ledger after both real runs finish. Do not copy older rule-run or benchmark numbers into the new run.
