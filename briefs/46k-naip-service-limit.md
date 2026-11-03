# 46k — actual NAIP service max is4000, not4096

Product edit only web/src/aerial/detail.js, web/src/aerial/drape.js:15–21; tests web/tests/aerial-detail-46a.test.js; QA web/scripts/aerial-detail-audit.mjs finalunexpectedcondition. No broad exploration/build/git/fulltests. Read only detail.js1–145, the namedcreditlines, and testrelevantNAIP assertions. Make all edits, focusedtest, syntaxcheck, stop.

Rootcause verified LIVE: curl exportImage size4096,4096 returns HTTP200 with JSON error400, `The requested image exceeds the size limit.` Official https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer?f=pjson maxImageHeight=4000,maxImageWidth=4000. OurGPUlimit4096isnotproviderlimit. Browserdetailstats.errors=1 silentlygotthis; nottimeout. KR works z19.

1. Add NAIP_MAX_IMAGE_PX=4000. US planDetail must cap its outputpixels ANDkey to min(GPU/mobilecap,4000). KR keeps4096. naipDetailUrl must independently cap requestedsize to4000 too, so it cannotreturn4096. Keepexactbounds/adjustAspectRatio=false. No upscaling4000bitmapinto4096canvas: planpixelsmustmatchURL. Preserveexistinglimitsmobile2048, GPU512, etc. Correct stale4kcommentifneeded.
2. Update actual US4096pixel assertion to4000. Add focusedregression: planDetail US cap16384 and naipDetailUrl size4096/8192 neverexceed4000, KRcap4096unchanged. Do not change span4096metres assertions; metresarenotimagepixels. Run node --test web/tests/aerial-detail-46a.test.js 2>&1 | tail -15.
3. Providercredit metadata copyrightText is `USGS, USDA, The National Map: Orthoimagery. March 12, 2025.` In drape.js change USGS_CREDIT to `Imagery: USGS / USDA · The National Map`, NAIP_CREDIT to `Imagery: USGS / USDA NAIP (public domain)`. Comments should reflectdetailnowusedinnormal3D too. Constantusersalreadycompareimports, nootherUIchangesneeded.
4. QA runner finalunexpectedcondition must also flag data.stats.errors>0 for non-failNaip cases; keepfullstats. Thecontrollerfailurecounterwasnotincludedpreviously. FailNaipintentionalerrorsstillallowed. Node --checkscript.

No sourceupscaling/sharpening. No choices/commutes/engine changes.
