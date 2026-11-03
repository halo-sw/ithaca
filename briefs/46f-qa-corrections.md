# 46f — surgical QA fixes only

Edit only `web/tests/aerial-progressive-46e.test.js` and `web/scripts/aerial-detail-audit.mjs`. Product is unchanged. No exploration, git, full tests/build or browser. Read these two small files only. Make edits in one batch, node --check script and node --test web/tests/aerial-progressive-46e.test.js with tail -15, then stop.

1. Progressive test `evicted preview never publishes onOk`: drapeAreaOnce invokes drapeFn in a microtask. After const p=drapeAreaOnce(...), BEFORE typeof captured assertion, await one setImmediate turn. This fixes test timing; do not weaken assertion/product.

2. QA runner: require(PW_PATH) directly. chromium.launch must use channel:'chrome', headless:false.
3. Actual store exposes getState(), hasAction(name), act(name), not state or actions. Everywhere read store.getState(). Wait ready === true and appropriate action available before pause. If tour/close, getState().tourPlaying and hasAction('toggleTourPlay') then act; if sim/fixture, getState().playing and hasAction('toggleSimPlay') then act. Remove invalid DOM query :has-text fallback. This pause must work. base wait uses getState().aerial; captured state uses getState(). Record playing/tourPlaying/clock for verification.
4. pangyo-close: after pause set camera.position to controls.target + (camera.position - controls.target)*0.25, then controls.update(). Do NOT scale target itself. Only camera change.
5. menlo-medium URL currently relative and page.goto has no baseURL. Normalize finalUrl always absolute with new URL(selectedPath,BASE_URL). All cases must work.
6. detail.stats.pending is boolean, no overviewPending. Wait at least 25secs after base for wide/close and up to 80seconds for sim when detail pending. Do NOT break on swaps while pending; require !pending. For no pending/no swaps after25sec finish overview-only. Record final pending/settled. Base preview success may precede finalbase; allow at least25secs for allcases so screenshot doesn't race finalbase. Fail case25secs. No long idle loop after settled.
7. log '[aerial-detail]' too. creditselector add '.ui-simcredit'. Count timeout, proxy, pageerror, shader/otherconsoleerror as unexpected. Only ignore intentional503 console/HTTP in failNaip case (match503; don't ignore allconsoleerrors). Capture all errors unchanged inJSON. No secretvalues.

No other edits. This corrects the existing QA harness rather than changing product behavior.
