# 46j — one moving-camera QA case and default desktop quality

Edit ONLY web/scripts/aerial-detail-audit.mjs. No product changes, git/build/fulltests/browser. You may read this300line runner. Keep currentcases unchanged; node --check then stop.

Add `pangyo-medium` case: same as pangyo-wide, query q=medium, kind tour, dpr2. Existing kind tour logic pauses it. This checks the default desktop quality at retina; useexplicitqmedium to removeambiguity.

Add `menlo-moving`: same fixture/path/kind as menlo-home, `motion:true`. After existing base/detail settle loop and before rAF measurement, when def.motion:
- capture actual store/camera/detailstats/textures as motion.before and screenshot<case>-start.png.
- start page.video recording via context option recordVideo ONLY for def.motion (dir outDir, size1440x900), so final video includesload too but available toinspectmotiontail. Set speed to0.1 using store.act('setSpeed',0.1), then toggleSimPlay if notplaying. Wait8sec, pauseifplaying. Capture motion.after withsamefields includingclock minute andcamera; screenshotexisting<case>.png after motion.
- Include motion object incaseJSON; do not change recordedrun, engine, camera directly, preferences, seed, or route. This is playback only of the existing QA fixture, not anewMuse evidence run.
- Save video path afterpageclose if easy, or leaveautomaticwebm inoutDir andprintpath. Ensure browser/contextclose onfailure.

Avoid heavycontinuoussampling; onlybefore/after and8secondsplayback. No assertions ofsmoothnessbasedonRAFalone; orchestratorinspectsframesvideo. This tests the newlyadded moving detail layer.
