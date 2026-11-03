# 48f — retain readability in the neutral fallback

Muse Code only, one palette correction + affected existing tests. No git/browser/build/full suite/subagents. 18 steps.

Full-suite found a real contrast regression: painted-17b shaded walls vs ground at 08:50 went from required >=15 luma levels to11.58 with stone 0xb7bbb0. Do not weaken the threshold. Use a lighter equally neutral stone/sage `0xc2c6bb` for BOTH PAINTED_LOOK.regionalGround and terrainBase in render/look.js lines80–95. Its luminance is close to the original warm beige while chroma removes the sandy cast. Keep all other palette/geometry unchanged.

Update existing exact snapshot expectations to the new intended value in web/tests/render-look.test.js:86–109 and web/tests/painted-17b.test.js:158–165. Its contrast check199–213 must remain >=15. Update the pure screen-color checks in web/tests/painted-17c.test.js:7–69 and painted-17d.test.js:1–55 to exercise actual PAINTED_LOOK.terrainBase instead of a stale 0xcfc4ad literal; update beige descriptions to neutral ground. Keep every existing contrast/clipping/fog threshold; don't remove assertions. Generic lerp/nightTint examples can remain arbitrary colors.

Run only these four focused test files with tail -20. If contrast still fails after two attempts stop, do not weaken. No unrelated edits. Stop.
