# 50f — One remaining obsolete test assertion

Muse test-only, max5 steps. Read ONLY `web/tests/map-frame-29M2.test.js:285-315`.

Orchestrator reran entire suite: 3,782 passed, 3 skipped, 1 failed: line308 `SSR pending keeps workplace stop label` exact `판교역`. The workplace pill already supplies 판교 and collision suppression correctly hides a duplicate label. The nearby station `선릉역` assertion passes and is the positive pending-state coverage. Keep exact `선릉역`, keep no-English checks, and assert the workplace pill (`회사 · 판교`) instead of requiring a duplicate workplace station label. Rename test accurately (Korean SSR keeps nearby names while workplace pill names work). Do not weaken with generic truthiness or remove coverage; no product edit.

Run `node --test web/tests/map-frame-29M2.test.js 2>&1 | tail -15`, then stop.
