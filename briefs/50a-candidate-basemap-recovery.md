# 50a — Make the candidate basemap visible, recoverable, and legible

User shows Jamsil candidate map with flat beige ground and only subway/price pins. All product code/tests must be Muse-authored. You are Muse. Implement this part only, then stop. No git/build/full suite or exploration. Maximum 24 steps. Read only named ranges/files.

## Evidence gathered by orchestrator

- Public Pages + real relay, restored Jamsil family recording: candidate map initially blank while normal tiles still loading. Relay returns real 200 PNGs with roads/blocks; after completion tiles DO render even without CORS attributes. Do NOT claim CORS is the root cause or change relay/auth/bounds/quotas.
- `web/src/ui/chatmap.jsx:248-250` has a lifetime failed Set of z/y/x and cumulative failCount; errors survive different views/providers. `:609-610` assumes imagery is on before a single success. `:939-978` hides real vector ground while imagery is pending. Underlay errors don't trigger rendering. No recovery button.
- `:908` uses opacity .45 only in English. At normal Jamsil neighborhood zoom roads/buildings become nearly white. Actual DOM probe .9 restores legible map with same palette. The SVG group filter also bounds enormous low-zoom underlay tiles (8,640 px wide in neighborhood view): constrain filter processing to viewport without cropping the viewport content.

## Allowed reads/edits

- `web/src/basemap.js` (whole, small pure helper module). Add minimal pure helpers if useful for current-visible URL load state; do not change provider/URL/geometry/zoom math.
- `web/src/ui/chatmap.jsx:1-28,210-265,589-618,865-885,889-980,1448-1510` only. Main edits here.
- `web/tests/chatmap-26o.test.js` and `web/tests/basemap-25a.test.js` read for existing conventions; do not weaken assertions. Add `web/tests/basemap-50a.test.js` for meaningful state behaviors.
- If necessary locate CSS filename via `rg -l 'ui-chatmap-credit' web/src/ui/*.css`, then read only lines 1030-1065 and 1155-1193. Prefer reuse the existing credit/side column rather than new unmeasured floating overlays.

## Changes

1. Replace the lifetime aggregate failure counter with load state keyed by FULL provider URL. Compute state for the CURRENT visible normal tiles and underlay only. Pending is not success; failures in another view/provider do not disable fresh tiles. OnLoad/onError update state idempotently. Keep successful images mounted. Bound retained state (avoid growing forever during pan), and avoid setState loops when equivalent tile lists are rebuilt.
2. Always draw the existing real parks/water/roads as a base beneath imagery (move existing vector block before raster group). Never synthesize geometry. Successful imagery can cover it; failed/partial tiles must not erase it.
3. Loading/unavailable/partial state should be clear in the existing map credit/control column, with localized English/Korean text and one accessible Retry button when errors occur. Manual retry retries failed visible URLs only, not successful tiles; no permanent blacklist. Keep source credit accurate when any displayed imagery comes from provider, including underlay. Pending/hung requests should transition to recoverable state after a sensible bounded timeout (~12 s) with cleaned timers; no infinite retries, no automatic flood. Retry must remount/re-request failed image URLs without adding bogus query params. Do not hide pins or block pan/zoom.
4. Use the same basemap opacity .9 in English and Korean (keep current muted filter/palette). Bound `basemap-mute` filter to current SVG viewBox using userSpaceOnUse, x=0 y=0 width=W height=H. Keep every raster inside the mute group and subway/pin overlays outside. Do not add crossOrigin unless necessary (browser proved it is not needed).
5. Add tests for pending != loaded, loaded underlay still credited when detail fails, partial error with successful tile preserved, retry selecting only failed current URLs, change of view/provider not contaminated by previous errors, late event/retry generation safety if applicable. Prefer test pure production helpers actually used by component. Existing filter and URL tests should continue to pass.

Run only: `node --test web/tests/basemap-50a.test.js web/tests/chatmap-26o.test.js web/tests/basemap-25a.test.js 2>&1 | tail -20`. Stop after at most 2 fix attempts and report concise result. Orchestrator will do real browser normal/slow/all-error/retry/pan/provider/language tests and full build/suite.
