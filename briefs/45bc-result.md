# 45b–45c regional 3D ground — orchestrator result

2026-11-03. Product code and tests authored by Muse Code (`muse-spark-1.3`) through briefs45b,45c1–45c6. Codex investigated, ran verification and assembled evidence. No production deployment in this stage.

Implemented local display-time daylight for Seoul/Bay Area; footprint/terrain-aware base planes; destination road/water/marking/tree layers and night material registration; USGS max zoom16 and no-tile fallback; drape target identity, failure retry and eviction; destination aerial state and region-correct credits.

No engine accounting, inputs, decision records or raw/built data changes. Preserve prior45a follow-camera fix. US imagery follows existing source resolution; DEM-exterior fringe is flat fallback, not new terrain data.

Verification:
- `npm test`:3510 total,3507 pass,3 skipped,0 fail.
- `npm run build`:pass; existing large-bundle warning.
- `npx astryx doctor --built .` in production source/build snapshot:19 pass,3 warn,0 fail; existing1350 style findings.
- `git diff --check`:pass.
- Existing loaders + actual data: all footprint vertices within new ground in st-강남,pangyo,st-판교,us-menlo,us-st-palo-alto.
- Chrome1440x900,quality=low: Pangyo tour/destination; Menlo tour/home/destination; Palo Alto; Menlo midnight; all-tile-failure Pangyo fallback. No JS exceptions. Valid requests no HTTP failures; injected503 only in failure case.
- Final source recapture: Pangyo destination aerialSecondByArea.pangyo=true; US destination us-menlo=true; primary aerial=true. Region id preserved from run.meta.area.
- Palo Alto: pre-change72 z17 tiles404; final20 z16 tiles successful. Menlo whole-area90 z15 tiles successful.

QA artifacts are in the orchestrator workspace `2026-11-02/dl/work/region-ground`; user-facing screenshots/report under its outputs directory. Menlo fixture is a rules replay for map QA only, not a new Muse evidence run. Main final presentation and public deployment remain separate tasks.
