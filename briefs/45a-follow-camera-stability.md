# 45a — Stable follow camera during real playback

Product code and tests authored by Muse Code. Follow AGENTS.md. One bounded part; no sub-agents, no git, no full suite/build, no web/network tools, no keys. Do not alter simulation records, routes, prices, times, model choices or UI layout. Only rendering camera motion.

## Reproduced by orchestrator in real Chrome

Local latest f81d1d6. URL `/?mode=sim&scenario=demo-two-homes&home=A&day=1&t=07:38&follow=1&lang=en&quality=low`. Play at 0.1x for 10 seconds. Captured camera coordinates each rendered frame.
- Walking (journey phase idle): camera Y ranged 567.84–1283.26 even though followLift is capped at 60. A single walking frame moved 102.51 world metres (mostly vertical).
- Rising into train view: single frames jump 1287m and 2018m at integer minute boundaries. Between boundaries camera remains stationary.
- The user specifically reports the entire screen shaking when following a person.

## Read only the needed ranges

- `web/src/main.js:14,57` imports.
- `web/src/main.js:2288–2330` lift state, followBlocked ray, setFollowPose.
- `web/src/main.js:2407–2475` paintFollow. Main fault:
  ```js
  camera.position.lerp(gpos, k);
  // ...
  followLift = followPitchFor({ blocked: followBlocked(followHead), pitch: followLift, maxPitch: 60, basePitch: 0 });
  camera.position.y += followLift;
  ```
  The lift feeds back into next frame's camera position, accumulating rather than being an absolute offset. Raycast also tests this changing raised camera, creating raise/lower feedback.
- `web/src/main.js:2993–3030`: journeyFrame floors minute before calling journeyCameraState.
- `web/src/main.js:3107–3194`: cruisePose and paintJourney use elapsed/progress directly.
- `web/src/main.js:3539–3623,3678–3704`: explicit seek/day/member/view actions.
- `web/src/main.js:3732–3807`: render loop calls paintFollow twice when integer minute changes; train marker manually adds fractional minute to jfTrain.elapsed.
- `web/src/render/scene29L1.js:44–60`: old per-call followPitchFor helper (keep legacy export/tests compatible if new helper is clearer).
- `web/src/journey.js:250–281`: journeyCameraState floors minute itself.
- `web/tests/scene-29L1.test.js:41–51`, `web/tests/journey-view.test.js:175–255`: existing behavior contracts.

## Required behavior

1. **Absolute, frame-rate-independent occlusion lift.** Keep followLift bounded 0–60 metres. Probe occlusion from the nominal goal camera position (`gpos`, before lift), toward the followed person's head, rather than from last frame's lifted camera. Smooth lift over elapsed real seconds, with a small clear-view hold/hysteresis (e.g. 0.25–0.35s) before lowering so building edges do not chatter. Add lift to the GOAL position before the camera interpolation; never add it to the already smoothed camera afterward. A small pure helper in `render/follow-camera.js` is fine. Clamp dt/sanitize inputs. Same elapsed time at 30/60/120 fps should converge nearly identically.
2. **No periodic catch-up snap during continuous playback.** Current `controls.target.distanceTo(glook) > 60` makes the camera snap repeatedly at faster speeds. Preserve immediate placement for explicit seeks/member changes/resume-follow; set snapFollow in the existing setDay/setMinute/applyView-time paths as appropriate. Continuous walking should not jump solely because smoothing trails the target. Keep normal motion responsive and person visible at watchable speed. Reset lift/hold state when explicitly jumping or entering/leaving the journey camera, to avoid carrying an old occlusion into another scene. Do not disable follow controls or remove occlusion handling.
3. **Continuous ride camera time.** Preserve fractional `minute` in journeyFrame and journeyCameraState for progress/elapsed. Existing integer boundary phases and captions retain their behavior. Remove the extra `minute - Math.floor(minute)` addition at `journeyLayer.setTrain` since elapsed will already include the fraction. Camera and train must use the same elapsed value.
4. **One camera update per animation frame.** On integer minute change update the clock and set a caption-refresh flag. Call paintFollow exactly once later in the render loop using that flag; do not run the camera twice with the same dt. Explicit user actions can still place a view immediately.

## Tests

Add focused behavioral tests (new `web/tests/follow-stability-45a.test.js` or extend suitable pure suites):
- Sustained blocked input over several seconds keeps lift <=60; clear input settles toward zero; short alternating clear samples do not chatter.
- At 30/60/120 fps, equal-duration lift transitions are nearly equal. dt=0 does not advance state; invalid values cannot create NaN.
- journeyCameraState at two fractional times within the SAME minute has different elapsed/progress; integer boundary phase tests still pass; train sampling with these times moves continuously.
- Keep existing follow zoom/rotation and journey tests passing. Do not add tests merely checking source strings.

Run only new tests + `web/tests/scene-29L1.test.js`, `web/tests/journey-view.test.js`, `web/tests/follow-20f.test.js`, `web/tests/camera.test.js`, `web/tests/render-camera-trees.test.js`. Use short output. If a test still fails after 2 fixes, stop and report. Orchestrator will capture actual browser motion, run full checks/build and inspect all edits.

Final answer: changed files, concise behavior, targeted test summary. No commit.

## Orchestrator result — 2026-11-03 KST

Implemented by Muse Code (`muse-spark-1.3`) after the user explicitly approved relevant-source transmission and use of the existing login. Changes are limited to follow-camera rendering and fractional journey playback; simulation inputs, routes, prices, elapsed trip times and model choices are unchanged.

- Occlusion lift now offsets the nominal camera goal before interpolation, with a 60m bound and a short clear-view hold. It no longer accumulates on the rendered camera or feeds its own occlusion test.
- Continuous follow no longer snaps solely because the camera trails its target; explicit seeks still place the camera immediately. Journey progress retains fractional minutes and the camera updates once per animation frame.
- Same demo walking scene at 0.1x: camera Y range before 567.84–1283.26, after 567.84–626.69; largest observed walking-frame displacement before 102.51, after 2.57 world units. These are diagnostic observations with differing frame rates, not a general performance benchmark.
- Actual saved couple run `cmvzm1bok85ad`, home A, day 1 around 08:14: walking camera height stayed at approximately 627.84. Chrome checks at 0.1x and 1x completed without JavaScript errors. Normal accelerated travel and existing arrival transitions remain; this is not a claim that every camera transition has been redesigned.
- Targeted tests: 64 passed. Full JavaScript suite: 3,475 passed, 3 skipped, 0 failed. Production build and `git diff --check` passed. Existing large-chunk warning remains.
- Astryx doctor on the production-source/build snapshot: 19 pass, 3 warn, 0 fail. Existing styling/component warnings remain. Test fixtures were excluded from the production audit because their literal example CSS imports are not production dependencies.

Local validation only; public deployment and final presentation re-recording remain separate tasks. Preview and QA report are in the presentation workspace's `outputs/` folder.
