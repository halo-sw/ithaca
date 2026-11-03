# 48b — compare map states with the same frame

Muse-only QA script edit, only web/scripts/aerial-detail-audit.mjs. No product/main/look/testchanges (48aownsrenderer). No git/build/fullsuite/browser. Readscript existing365linesonce. Max15steps. Addcomparisoncasesandthenstopnode--check.

Keepallcurrentcases. Add:
- pangyo-night: existingpangyo-wide toururltime21:00
- pangyo-paint: samepangyo-wideurltime12:00&ground=paint
- pangyo-paint-night: samepangyo-night&ground=paint
- menlo-paint: sameexactmenlo-homefixtureurlt08:20 addground=paint
- menlo-paint-night: sameexactmenlo-nightfixtureurlt00:00 addground=paint
- menlo-all-imagery-failed: same menlo-homeurl but intercept ALL baseanddetailimagery requests intentionally503 (api/aerial/** + arcgisonlineWorld_Imagerytiles + USGSNAIPPlus export), notonlyNAIP. SourceURLsdiscover drape.js top10–100 anddetail top10–25 only.

Each addedpaint/allfailedcase def.noImagery=true. For these DO NOTwait90secfor aerialtrue, whichmuststayfalse. Waitrendererready thenatmost3secsettle, capturedataevenbaseOkfalse, markexpected noImagery ifaerial!==true. Groundpaintnorequests expected; failurecase503onlyexactinjectedimagery requestsallowed, shader/pageerrorsstillfail. Actualfailedimagerycalls recordedsmallcount/status; failifundocumentedrealerror. AttributionmustNOTclaimphotousedwhennone. AllotherloadedcasebaseOkrequired.

Camera matching: retainper-camera-groupcapturedpos/targetfromfirstloadedcaseandrestoreforpairedpaintcasesafterpause; group pairs pangyo-wide/pangyo-paint, pangyo-night/pangyo-paint-night, menlo-home/menlo-paint/menlo-all-imagery-failed, menlo-night/menlo-paint-night. For night/daycomparison usercanseegeographicdifferencesbut don'tpretendsameframeifnotrecorded. Bothsameviewportq andDPR (1) asoriginalcase. Logcamcoordinates forproof. SettingQA camera isallowed, no productpatch. readactualcontrols update. Nofake screenshotedits.

Tileproxyforwarding hashardcoded `.replace(/:48953/,':48741')` afterBASE_URLreplacement. Removehardcodedreplace; use URLpath+query againstTILE_PROXY directly. OrchestratorusesPUBLICexistingrelay https://ithaca-relay.vercel.app (userexplicitapproved). Do notextractcredentials. Keepownedbrowsercleanupandfailingcasescreenshots. Waits<=1sec polling. Do notchangefailurethresholdstomakegreen.
