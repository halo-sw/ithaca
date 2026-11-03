#46b — improve the broad base mosaic, Muse code only
Standalone small part. No exploration/git/build/fullsuite. EXACT PATHS: web/src/aerial/drape.js lines99–119,218–228,285–335 and web/tests/aerial-reliability-45c.test.js1–45. NO web/src/map directory exists. Do not guess paths. First failed run only read files; no edits exist. Read these ranges in ONE batch then edit.

Cause: pickZoom2km yields17 (Pangyo81tiles2304px); whole8kmUS steps to15 (90tiles~2.5k). Detail layer alone cannot improve far overview. Improve base imagery within bounded desktop GPU memory while preserving defaults for existing callers/tests.

1. drapePlan(bounds, options) add `maxMosaicPx=MAX_MOSAIC_PX`, `detailBias=0`. Clamp cap256..6144 and respect cap bothaxes. zoom = pickZoom(widthM)+bias (capKR19,US16); downstep to cap. Existing default exactly unchanged. Never US>16.
2. drapeAerial before plan: choose runtime cap=min(renderer.capabilities.maxTextureSize ||4096, viewport mobile?4096:6144). viewport mobile based on renderer.domElement.clientWidth if available<=768; unspecified fallback4096 (unit fakes retain old). detailBias=1 when desktopcap>4096, otherwise0. Call drapePlan with options. Surface area cap36MP, not8192/16k. No source/key change. drapeCorridor unchanged (performance).
3. Set texture.userData.aerialMpp = approximate horizontal metres / canvas.width for base texture (compute real tile bounds via tileToLonLat/range, haversineM; geographic image width for wholebounds alone underratesedge). Needed by detail module to avoid applying coarser detail over finer base. Ensure userData exists for tests/fakes. Stats return canincludewidth,height,mpp without breaking priorAPI.
4. close each ImageBitmap after drawing fetchMosaic (tryfinally safety). Do not close texturesourcecanvas. No other changes.

Tests in new web/tests/aerial-overview-46b.test.js: actual Pangyo bounds[127.10,37.38,127.125,37.401]6144bias1 => >=18; US bounds[-122.20,37.43,-122.11,37.51]6144=>16; defaultUScap4096 remains<=16; allplansdimensions<=cap, mobileunchanged. Run onlynew+ aerial-reliability45c.
