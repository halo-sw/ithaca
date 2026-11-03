# 48c — finish the shared map material system

Muse Code only. One renderer part. Read only named files/ranges. No git, browser, full suite, build, subagents, or notes. Max 22 steps; edit in few steps.

48a GPU checks show textured roofs/walls and aerial ground now remain visible at night. Keep that solution. Two finishing fixes:

1. `web/src/render/look.js` lines 65–105: PAINTED_LOOK regionalGround and terrainBase both currently 0xcfc4ad, a sandy beige unlike the aerial slate/green urban map. Set both to the same muted stone/sage neutral 0xb7bbb0. Preserve mapped grass/forest/water, roads, building identity and DEFAULT_LOOK. Update the obsolete warm-beige comment. This is a schematic fallback, never invented photo detail. `web/src/palette.js` first 20 lines: GROUND_PLATE currently 0xd8cdb2; use a subtly lighter neutral stone 0xd1d0c5 so complex paving fits the same family. No region-specific palette; Pangyo, Gangnam, Menlo, home and destination share it. Do not change geometry or aerial photos.

2. `web/src/render/surface-night.js`: global Set patched currently retains all disposed destination materials. Register a single material `dispose` listener while patching which removes that material from the Set and unregisters itself. No renderer-wide clear on one material's disposal. Keep lazy compilation, existing chain order, factor propagation, no per-frame allocations. Fake materials without event API still work. Add meaningful test in `web/tests/surface-night-48a.test.js`: dispose one event-capable fake material, change factor, its old shader is no longer updated while another live material is, and repeated patch is idempotent. Do not export internal Set just for testing.

Run only `node --test web/tests/surface-night-48a.test.js` with tail -15. Stop with concise outcome.
