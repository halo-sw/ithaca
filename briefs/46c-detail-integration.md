#46c — fix review findings and wire camera detail (Muse code only)
Read exact ranges only, no repo exploration/git/fullsuite/build. Prior46a creates aerial/detail.js;46b improves base drape. Product tests/code via Muse. Main integration is a small seam, don't redesign.

## Review fixes in web/src/aerial/detail.js
Read168–195,120–135,450–625 (line numbers may drift).
1. effectiveCap incorrectly calls renderer.capabilities.getMaxTextureSize(); Three uses numeric `.maxTextureSize`. Read property, retain mobilecap2048. Add test withGPU512.
2. Shader currently appends blend AFTER map chunk and replaces diffuseColor.rgb with dCol. This erases material tint (night!), and vertex color later handles separately. Instead inject blend into THREE.ShaderChunk.map_fragment BEFORE `diffuseColor *= sampledDiffuseColor;`, modifying sampledDiffuseColor.rgb. Retain original mapchunkUSE_MAP and original multiplication. Samebounded rectangle/2%feather. Test preservation of base diffuse multiplication contract.
3. On KR19→18 fallback the resulting full tile bounds, worldBounds and pixels may change. Recompute them from range using tileToLonLat+lonLatToXY exactlyasplanDetail, preserve requestedkey separately so controllerdoesnotrefetch endlessly. Shader uses actual fallbackextent. Add fallback test.
4. Avoid COARSER detail over betterbase: base texture now carries map.userData.aerialMpp. Use per-material shared onBeforeCompile uniform threshold, compare patch mpp (worldBounds width/pixels[0]) < that material's currentbase mpp*0.9 before applying. Minimum tracked base mpp may skip entire request if no registeredmaterial benefits. New base maps may arrive later; refresh threshold at throttled update500ms, not perframe. Unknown mpp allows detail for tests. Resultsourceactual mustremaintruthful.
5. pendingrequest stale: when desiredkey changes cancel and invalidate immediately (unless it equalsresidentKey, then cancelpending too). Do not allow a late response for a previous camera position to swap whilewaitingforstablecandidate. Dispose doesn'tpatchrestorationneeded becausepageends; unregister restores handlers. Texturecreationfailure should clearpending/errorbackoff, not remainstuckforever. Boundtoonepending/resident.
6. planDetail width>~5461 currentlyclampsspan8192 causinginsufficientcoverage. Foroverwide views skip detail (throwRangeErrororreturnhandled). Wholemapusesimprovedbase.

## Main integration exact locations (main.js)
- import createAerialDetail from ./aerial/detail.js near aerial import.
- buildWorld around450 before drapeAreaOnce: create `aerialDetail` iff PARAMS.get('ground') !== 'paint' and PARAMS.get('detail') !== '0' and mode is not isomap; otherwisenoopnull. PassTHREE,renderer,origin,usArea:isUsArea(area),look:LOOK. register[terrainMesh,groundMesh,roofMesh,base]. onReady log only `[aerial-detail] ${source} ${size...}` (no URLs) forQA. Statsaccessible returnedhandle. After base onOk (around460) call aerialDetail?.enable(). Existing applyPaintedNight kept.
- include aerialDetail in buildWorld return near734; destructure it in bootTour near831 and bootSim near1478.
- before each renderCtl.renderFrame (tour1040,sim3991): call aerialDetail?.update({target:controls.target,framedWidthM:tourFramedWidth or simFramedWidth,now:performance.now()}). No cameraheight, routes, accountingchanges.
- destination buildAreaLite near3020: after g addedtosscene, register[fringe,liteTerrain,gm,liteRoof]. onOkenable. Return handlearray `detailMeshes`inliterecord. Eviction near3045 aerialDetail?.unregister(slot.detailMeshes) beforegroupremoval. Ensure invalid/nullnotpatched.
- isomap built objectshouldnothavedetailenabled toavoiddualasyncrepaint (mode PARAMS.get('mode') exactlyisomap — read bootdispatch bottomifneeded).

No UI newsetting; detail=0 diagnosticqueryonly. Use existing USGS TheNationalMap credit (NAIP is same USGSNationalMapsource); ATTRIBUTION canappend officialNAIPservice source ifmissing, no sourceinvention.

Run aerial-detail-46a.test.js + aerial-overview-46b.test.js. Stoplistfiles/tests. NextpartbrowserQA scriptcomesseparately.

One additional exact fix: fetchKrCanvas uses Promise.all; first rejection returns whileother5workersstillfetch, then19→18 fallback startsnew6workers. Await allworker settlements before fallback or abort siblingworkers withlocalcontroller. Keep totalconcurrency<=6 and no fallback while oldbatchrunning. Prefer Promise.allSettled andrejectifanyfailed; existing perworkerabortcheck handlesparentcancellation. Do not rework unrelatedmodule.
