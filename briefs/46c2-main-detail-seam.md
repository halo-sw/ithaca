#46c2 — wire existing detail controller into main only
Only edit web/src/main.js. No reading detail.js/tests/otherbriefs. Controller APIgivenbelow. No exploring. Batchreadranges once (450–473,724–735,824–834,1470–1482,3010–3055,1034–1045,3984–3997). Thenonebatcheditall. Do not read wholemain. No git/fullsuite/build/newtests.

API import{createAerialDetail}from './aerial/detail.js'; factory({THREE,renderer,origin,usArea,look,onReady}) returns register(mesharray),unregister(mesharray),enable(),update({target,framedWidthM,now}),dispose(),stats(). Alloptionalhandlecallsnullsafe. Paramsmodeisomap is PARAMS.get('mode') === 'isomap'.

Changes:
1. Addimport besideexisting aerial/drapeimport.
2. Before primary drapeAreaOnce section450, create const aerialDetail using factory only ifground !=='paint',detail !=='0',mode !=='isomap' and(LIVE_API||isUsArea(area)),elsenull. PassTHREE,renderer,origin,usArea:isUsArea(area),look:LOOK; onReady log `[aerial-detail] source=<...> size=<...>` onlymetadata. register[terrainMesh,groundMesh,roofMesh,base]. Enable only primarydradeonOk afterstore aerialtrue. No requestbeforebase.
3. buildWorldreturn addaerialDetail nearaviationMat. bootTour andbootSimdestructure addaerialDetail alongsideaviationMat. Do not touch camera/clock/engine.
4. Immediatelybefore tourrenderCtl.renderFrame: aerialDetailupdate controls.target,tourFramedWidth,performance.now. Before simrender analogsimFramedWidth. Nocameramoves/otherlogic.
5. buildAreaLite afterscene.add(g): constdetailMeshes=[fringe,liteTerrain,gm,liteRoof]; aerialDetail?.register(detailMeshes). onOkcallsenable. ReturnrecordincludesdetailMeshes.
6. ensureSecondAreaeviction insideif(slot), before scene.remove: aerialDetail?.unregister(slot.detailMeshes). Existingnightentries/cache intact.

Exactlythese mainchanges. Optionaldetail=0 queryisdiagnostic, noUI. `node --check web/src/main.js`; nootherchecks neededforthis seam (browserQA follows). Stopwithchangedlines.
