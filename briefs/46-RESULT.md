# 46 — sharper regional aerial maps

2026-11-03. Product code, tests and browser QA runner authored by Muse Code (`muse-spark-1.3`), stages46a–46l. Codex diagnosed, wrote briefs/docs and ran verification. No engine numbers, routes, household decisions or saved simulation records changed.

## Behavior

- Desktop base mosaic budget max6144px with hardware/mobile caps. Actual Pangyo overview z17→18 (4608×4352); Menlo z15→16 (4352×4608). Legacy coarse photo paints first, final photo refines it. Failed refinement preserves preview.
- Camera-local imagery is bounded, quantized and debounced. Korean VWorld detail up toz19; USGS/USDA NAIP exports capped4000px per official service metadata, mobile2048 and GPU caps respected. Source output pixels do not establish native ground accuracy.
- Detail shader respects mesh world transforms, source bounds, base density and night tint. One resident detail texture and one pending request; stale responses cannot replace current view; cancelled requests and retired textures release resources.
- NAIP timeout45s follows real successful public requests of22–25s. Other detail requests retain20s. Provider failures retain base/previous detail and back off. USGS/USDA attribution updated.

## Verification

- Full JavaScript:3541total,3538pass,3skip,0fail,986suites.
- Production build succeeded; existing largechunk warning remains.
- Astryx doctor over production-only snapshot:19pass,3warn,0fail. Existing1350style findings remain.
- Browser cases: Pangyo overview, close, destination and medium/DPR2; Menlo overview, close, destination, medium/DPR2, midnight, injected NAIP503 and8s movement. Detail source/size, actualquality, errors and texturecount recorded.
- One midnight request hit a transient upstream CORS error, then recovered automatically. Separate fresh-browser midnight recheck: noerrors,4000pxNAIPresident. The original batch correctly returnednonzero for that error; it was not relabelled as clean.
- Injected503 caused two bounded attempts and preserved the base map. Normal rendered cases had noJS orshaderexception.
- Motion: textures19before/after, noJS/shadererrors. Moving changed desiredpatch, cancelling stale requests; requestcount1→4, resident1, newrequeststillpending atcaptureend. This doesnotprove continuous highresolution throughout acceleratedplayback. Short rAF samples varied8–42ms; not a60fpsguarantee.
- git diff --check passed.

Evidence retained in the companion chat workspace under work/46-browser, work/46-final-browser, work/46-night-recheck and outputs/ithaca-map-sharpness-qa.md. Repro runner: web/scripts/aerial-detail-audit.mjs (see its header/env settings); the Menlo fixture is a preexisting rules-engine replay for mapQA, not final Muse-run evidence.

## Outstanding

Not deployed or pushed. Initial/raw-photo latency, fast-movement detail wait, finite outer map boundaries and source-date/color differences remain. Existing US replay time-label/destination-anchor inconsistencies were observed and added to the master task list; they were not changed by this rendering task.

Next product priorities: verifier errors must not becomePASS; member preferences must survive profile→scenario→model; school-destination honesty; replay time/destination/English consistency. Then public web/relay/code parity, one final household run, matching video/README/submission. This stage doesnot mark the whole project complete.
