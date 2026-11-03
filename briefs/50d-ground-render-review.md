# 50d — Correct ground polygon compositing and failed-section caching

Muse-only code/test changes. Small reviewed follow-up; max16 steps, no search outside named ranges, no git/build/full suite.

Read/edit `web/src/map-ground.js:65-130,215-255,285-355`, `web/src/ui/chatmap.jsx:1010-1045`, `web/tests/map-ground-50c.test.js`.

1. The combined per-layer path currently uses evenodd across ALL distinct features. Overlapping polygons cancel each other into artificial holes (e.g. overlapping OSM/register footprints or multiple park boundaries). Preserve each Polygon's outer/hole ring identity while normalizing winding (outer one direction, inner opposite), including MultiPolygon, then render combined paths with nonzero fill. A signed-area helper can normalize copied ring arrays during conversion. Never mutate source data. Tests: hole remains a hole and overlapping distinct exterior polygons have nonzero summed winding in their overlap; MultiPolygon exteriors share winding. Update the test's previous evenodd expectation appropriately, not weaken hole verification.
2. Render parks BEFORE water so a park boundary containing a lake doesn't paint the lake green. Current Jamsil fallback screenshot shows green over the lake. Order: parks, water, buildings, roads. Existing raster still covers the ground afterward. No fabricated shapes or colors; use existing MAP_COLORS.
3. loadOneArea currently catches section errors to [] and then caches the incomplete area permanently. Preserve successfully loaded sections for this render but evict incomplete area from cache so next load retries failed section. Missing/non-array optional section is not a network failure. Add a test where first building-reference fetch rejects, second succeeds, roads stay available both times. Don't load graph/POIs or add auto-retry loops.

Run only `node --test web/tests/map-ground-50c.test.js web/tests/basemap-50a.test.js web/tests/chatmap-26o.test.js 2>&1 | tail -18`, then stop.
