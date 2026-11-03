# 46l — NAIP real latency budget

Edit only web/src/aerial/detail.js constants and startRequest timer. Current FETCH_TIMEOUT_MS=20000 is appropriate forKR but too shortforNAIP. Real curl atvalidsize4000 succeededin24.95s (2.3MB JPEG);2048 succeededin21.7s. HTTP200 actualimage, noterrorJSON. Add NAIP_TIMEOUT_MS=45000 and in startRequest timeout use plan.source==='naip' ? NAIP_TIMEOUT_MS : FETCH_TIMEOUT_MS. Preserve explicit abortonviewchange, onependingrequest, stablekey/retry logic. Base/oldtexture remainsvisiblewhilewaiting. No changes tootherlogic.

Read only detail.js15–28 and570–605 ifneeded. Run node --test web/tests/aerial-detail-46a.test.js 2>&1 | tail -15 thenstop. No newtestthatjustmirrorstheconstant. No git/build/fulltests/exploration. CodeonlyMuse.
