# 48d — correct actual imagery failure QA

Muse only. QA script only `web/scripts/aerial-detail-audit.mjs`. Max 22 steps. No browser, git, full suite, build, subagents.

Read lines 1–45, 98–165, 210–247, 390–416. Current QA missed the actual US base tiles, and local browser Referer forwarded to the relay caused Pangyo status403. Product source is correct; do not weaken relay access controls.

- `web/src/aerial/drape.js:26` actual base URL is `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`. failAll must intercept this AND existing NAIP/World_Imagery/api aerial paths (also api/tiles), returning intentional503. noImagery then must show false aerial and no image-source credit; preserve fatal attribution checks.
- Forward public tile-proxy requests with ordinary server-side fetch or an isolated Playwright API request context, WITHOUT browser Origin/Referer, cookies, or auth headers. Relay explicitly allows ordinary server-side tile requests with absent origin/referrer. Never fake an allowed origin, read credentials or change production allowlists. Preserve path+query, binary body, content-type/status, use bounded timeout. Add `/api/tiles/**` proxy as detail uses it. Current route.fetch forwards localhost Referer and gets403.
- Forced-failure case must restore existing menlo-day camera like paint cases, not overwrite it. Screenshot camera data must capture final actual camera after settle, not just at initial restore. Do not adjust product camera behavior.
- Classify intentional503 by exact intercepted endpoint, never suppress arbitrary503 or JS/page errors. Existing filter suppresses all503 for failNaip: narrow this too. Preserve diagnostics and fail exit on unexpected.
- Add Pangyo failure case if easy, using same day camera and same injection.

Run `node --check web/scripts/aerial-detail-audit.mjs`. Stop.
