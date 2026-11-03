# 50b — Close retry lifecycle gaps in 50a

Muse-only product authorship. Small follow-up; no exploration/git/build/full suite. Read/edit only `web/src/ui/chatmap.jsx:247-278,630-670,1018-1055,1540-1570`, `web/src/basemap.js:130-218`, `web/tests/basemap-50a.test.js`.

Orchestrator review found these real gaps:
1. `markTile` captures `tileGenRef.current` WHEN the callback fires, not when that image was rendered. Thus an old image's late error can overwrite its newer retry's success. Use per-URL attempt nonce captured in each image's onLoad/onError closure, compare to current nonce ref in state updater. Success from another still-current image must remain accepted when another URL retries. Full-URL React keys (not only z/y/x) should include provider identity.
2. Timeout effect depends only on visible URLs. A Retry in the same view does not restart the timeout. Depend on an explicit retry epoch/nonce change too. Timeout must reject obsolete attempt snapshots and clean up on retry/unmount/view change. Avoid resetting deadline on every successful sibling load.
3. `tileNonce` is unbounded while tileState is capped. Bound retained nonce state consistently without reviving stale attempt ids. A monotonic attempt counter assigned to failed URLs is simplest; never reuse nonce 0 for a previously retired live attempt. Keep successful image keys stable. Do not create setState loops.
4. Remove leftover `{null}` before subway layers and update obsolete underlay comment saying basemapOn counts only normal tiles.
5. Add `data-no-i18n` to localized status and retry elements to avoid DOM translator rewriting already-localized React children. Status remains within existing measured controls.

Do not change geometry/providers/URL schemas/auth. Preserve all prior tests. Add meaningful regression test(s) for per-URL stale event safety and retry attempt identity; orchestrator also exercises a second timed-out retry in a real browser.

Run only `node --test web/tests/basemap-50a.test.js web/tests/chatmap-26o.test.js web/tests/basemap-25a.test.js 2>&1 | tail -18`, then stop. Maximum 18 steps.
