# 45c6 — preserve the simulation area identity
Product source patch via Muse only. Read only the exact snippets below; do not explore.

In web/src/main.js near line3458 the45c5 patch accidentally changed the existing id from run.meta.area to area.id. Loaded area JSON has `area` and `label`, NOT `id` (confirmed Pangyo/Menlo/Palo Alto). Restore the established id and label while retaining metadata:
Current:
`area: { id: area.id, label: area.label, country: area.country, bbox: area.bbox },`
Required:
`area: { id: run.meta.area, label: run.meta.area, country: area.country, bbox: area.bbox },`

In web/src/ui/app.jsx near1080 AttrLine currently:
`const isUsd = (state.money && state.money.currency === "USD")`
`  || aerialCreditFor(areaForCredit(state)) === USGS_CREDIT;`
Use only `aerialCreditFor(areaForCredit(state)) === USGS_CREDIT` so country/bbox takes precedence over stale money consistently (areaForCredit already handles USD fallback).

Only these two surgical edits. No new tests, no git/build. Run `node --test web/tests/region-metadata-45c.test.js 2>&1 | tail -12` then stop.
