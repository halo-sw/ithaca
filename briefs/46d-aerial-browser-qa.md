#46d — browser QA runner (all new code through Muse)
Write ONLY web/scripts/aerial-detail-audit.mjs, no product changes. No run browser, git, build, full tests. Use node:fs/promises, node:path, createRequire(import.meta.url). `process.env.ITHACA_PLAYWRIGHT_PATH` default '/Users/halo.axz-pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'. This is QA, not a product dependency. Orchestrator runs script. Check only `node --check`.

CLI: node web/scripts/aerial-detail-audit.mjs <outputDir> <case...>. baseURLenv defaulthttp://127.0.0.1:48953; tileproxyenv defaulthttp://127.0.0.1:48741. Browserchrome headlessfalse1440x900DPR1. ALWAYSclosebrowserfinally, perpagecaptureevenfailurewitherrors. Newcontextpercase toavoidIDB/HMRstate. Consolecollecterror,warnings,[render],[aerial]; pageerror; responseURL+statusonlypublicmapnoAPIkey; texturestats.

Instrument Vite TRANSFORMED /src/main.js response using page.route: exact `return {\n    origin, cx, cy, span, renderer, renderCtl, rig, scene, camera, controls,` replaced by preceding `window.__aerialAudit = {renderer,renderCtl,scene,camera,controls,aerialDetail,store};` plus originalreturn. No persistent source instrumentation. This occurs once in buildWorld. Needstore actualmoduleinstance, no dynamicstoreimport.
Route **/api/aerial/** forwarding port48953→48741 withroute.fetch+fulfill. Neverreadkey. Otherrequestsnormal. For `menlo-failure`, also intercept**/USGSNAIPPlus/ImageServer/exportImage* andfulfill503intentionally. Do not log failedmapsaspass.

Cases:
- pangyo-wide: area=pangyo&time=12:00
- pangyo-close: same, afterstore.readypause tour, then scale offset(camera-controls.target)by0.25 andcontrols.update; no scene/meshchange.
- menlo-wide: area=us-menlo&time=12:00
- menlo-home, menlo-dest, menlo-failure: load QA fixture from envITHACA_QA_RECORD default /Users/halo.axz-pc/Documents/Codex/2026-11-02/dl/work/region-ground/menlo-qa-record.json. Before sim goto landing & page.evaluate(import('/src/chat/idb.js').saveCustomRun(record)); navigate mode=sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20 (home/failure),home=B&t=08:40(dest).
- pangyo-dest: mode=sim&scenario=demo-two-homes&home=A&day=1&t=08:32&follow=1.
- optional menlo-medium: sameasmenlo-homebutq=medium; allothersq=low. quality querykeyis `q`, NOTquality.
Allquerieslang=en, autoplaypaused viaactualstore.actions afterready: iftourPlayingandhasActiontoggleTourPlay thenact; sim ifplayingandhasActiontogglePlay needreadweb/src/main.js3450–3550onlyforactionnameifnecessary; or useexactbuttonPauseclick. Avoidrandomcamera drift. Waitbaseaerialtrue timeout90sec, then waitdetailstats swaps>0 or errors>0 or no pendingoverview plus settled 25sec; cap80sec, failurecase25sec. No screenshotuntilbasehasloaded; timeoutlogandcaptureerror.

After settled capturePNG and JSONcase. JSON errors,logs,requests,storearea/aerial/aerialSecondByArea, audit.aerialDetail.stats(),camera.pos,target,renderCtl.quality,renderer.getPixelRatio(),scene renderer.info.render.calls/triangles,memory.textures,canvasbufferdimensions. Traverseactualmeshes record map.imagewidthheight, map.userData.aerialMpp, materialdetailshaderuniformsifaccessible, parentGroup. Also visible sourcecredittext. Never fulluserdata/secrets. Collect ~30requestAnimationFrame intervals once aftersettle formedianms (unloaded browsernotbenchmarkclaim). Capturefile<case>.png/json. PrintoneJSONsummarycase (errorcount,badrequestcount,detailstats,base sizes,actualquality), short. Prefer run remainingcases afterindividualfailure, exit1ifunexpectedpageerror/unexpectedHTTPfailure excludinginjectedNAIP503; visualQA remainsmanual.

Action name verified: actualstore.act('toggleSimPlay') whenstate.playing in sim. No mainreadneeded. PrimarybuildWorldreturnexactmarker remains asgiven. Productdetailhandle.stats isFUNCTIONcall.

Two extraQAsettings: menlo-medium contextdeviceScaleFactor=2 (actualretina; recordbuffer/quality), othercasesDPR1. Add menlo-night samefixture/A butt=00:00 tochecknewshaderpreservesnightmaterialtint. Foroverviewno-detail-needed do notwaitforeverforswaps: waituntilbaseaerialtrue then25seconds; detailedcases80secmaximum. Freshbrowsercontextforeachcase tokeepboundedGPUmemory.

Amendment overriding ONLY-script restriction: beforewritingrunner, make TWO surgicalreviewfixes only:
1. web/src/main.js455–456 factorycondition checks PARAMS.get('mode') !== 'isomap', butactualdispatch4160 is PARAMS.get('isomap') === '1'. Add PARAMS.get('isomap') !== '1' tofactorygate too. No othermainchanges.
2. web/src/area-ground.js previewwrapper currentlycalls userPreviewbeforecurrentpromisestalenesscheck. Move/check currententryatcallbackstart andreturnif cur.promise !== p beforeANYcallback, thenexistinguserPreview/onOk. Mustkeep existingargsidentityforbare spies. No othercachechanges.
Run node --test web/tests/aerial-progressive-46e.test.js 2>&1 | tail -12 andnode --check fornewscript. Noexplorationneeded; exactchangedfunction body short. These2sourcefixes areallowed, thenrunnerasabove.
