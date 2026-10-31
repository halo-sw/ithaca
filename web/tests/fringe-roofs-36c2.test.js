// Stage 36c2: fringe drape, corridor roofs, in-scene beige, broken glyph.
// Pure helpers only, no WebGL, no DOM.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sceneDrapeBounds, roofUv, drapedGroundMeshes } from "../src/aerial/drape.js";
import { uvForLonLat, tilesForBBox } from "../src/aerial/tiles.js";
import { splitRoofWall } from "../src/journey-scene.js";
import { repairComplexName, BROKEN_NAME_NOTE, labelItemsFor } from "../src/labels3d.js";

const ORIGIN = { lon: 127.1, lat: 37.4 };
const KX = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toWorld = ([lon, lat]) => [(lon - ORIGIN.lon) * KX, (lat - ORIGIN.lat) * 111320];

function fakeMesh(boxes) {
  // boxes: array of [w, s, e, n] lon/lat corners -> world corner vertices
  const pts = [];
  for (const [w, s, e, n] of boxes) {
    for (const [lon, lat] of [[w, s], [e, s], [w, n], [e, n]]) {
      const [x, y] = toWorld([lon, lat]);
      pts.push(x, 0, -y);
    }
  }
  const count = pts.length / 3;
  return {
    geometry: {
      attributes: {
        position: {
          count,
          getX: (i) => pts[i * 3],
          getY: (i) => pts[i * 3 + 1],
          getZ: (i) => pts[i * 3 + 2],
        },
      },
    },
  };
}

describe("36c2 fringe bounds", () => {
  it("sceneDrapeBounds contains the larger fringe corners", () => {
    const area = { bbox: [127.09, 37.39, 127.11, 37.41] };
    const terrain = fakeMesh([[127.09, 37.39, 127.11, 37.41]]);
    const fringe = fakeMesh([[127.07, 37.375, 127.13, 37.425]]);
    const out = sceneDrapeBounds({ area, origin: ORIGIN,
      terrainMesh: terrain, fringeMesh: fringe });
    assert.ok(out[0] <= 127.07, `west ${out[0]}`);
    assert.ok(out[1] <= 37.375, `south ${out[1]}`);
    assert.ok(out[2] >= 127.13, `east ${out[2]}`);
    assert.ok(out[3] >= 37.425, `north ${out[3]}`);
  });

  it("without a fringe mesh the bounds still cover the terrain", () => {
    const area = { bbox: [127.09, 37.39, 127.11, 37.41] };
    const terrain = fakeMesh([[127.095, 37.395, 127.115, 37.415]]);
    const out = sceneDrapeBounds({ area, origin: ORIGIN, terrainMesh: terrain });
    assert.ok(out[0] <= 127.09 && out[2] >= 127.115);
    assert.ok(out[1] <= 37.39 && out[3] >= 37.415);
  });
});

describe("36c2 splitRoofWall", () => {
  it("a unit cube: top face to roof, 4 sides + bottom to wall", () => {
    const P = [];
    const tri = (a, b, c) => { P.push(...a, ...b, ...c); };
    // Top (y = 1), wound so the geometric normal points up.
    tri([0, 1, 0], [0, 1, 1], [1, 1, 1]);
    tri([0, 1, 0], [1, 1, 1], [1, 1, 0]);
    // 4 sides.
    tri([0, 0, 0], [0, 0, 1], [0, 1, 1]);
    tri([0, 0, 0], [0, 1, 1], [0, 1, 0]);
    tri([1, 0, 1], [1, 0, 0], [1, 1, 0]);
    tri([1, 0, 1], [1, 1, 0], [1, 1, 1]);
    tri([0, 0, 1], [1, 0, 1], [1, 1, 1]);
    tri([0, 0, 1], [1, 1, 1], [0, 1, 1]);
    tri([1, 0, 0], [0, 0, 0], [0, 1, 0]);
    tri([1, 0, 0], [0, 1, 0], [1, 1, 0]);
    // Bottom (y = 0), normal down.
    tri([0, 0, 0], [1, 0, 0], [1, 0, 1]);
    tri([0, 0, 0], [1, 0, 1], [0, 0, 1]);
    const { roofIdx, wallIdx } = splitRoofWall(P);
    assert.deepEqual(roofIdx, [0, 1, 2, 3, 4, 5]);
    assert.equal(wallIdx.length, 30);
  });

  it("stored up-normals win over winding (flat-topped prism cap)", () => {
    // Two cap triangles wound downward, but authored with +y normals
    // like the corridor roof caps.
    const P = [0, 5, 0, 1, 5, 0, 1, 5, 1, 0, 5, 0, 1, 5, 1, 0, 5, 1];
    const N = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    const { roofIdx, wallIdx } = splitRoofWall(P, N);
    assert.equal(roofIdx.length, 6);
    assert.equal(wallIdx.length, 0);
  });
});

describe("36c2 roofUv", () => {
  it("equals uvForLonLat for the same inputs", () => {
    const bounds = [127.027608, 37.394364, 127.111157, 37.513716];
    const range = tilesForBBox(bounds, 15);
    const lonlat = [127.07, 37.45];
    assert.deepEqual(roofUv(lonlat, range, 15), uvForLonLat(lonlat[0], lonlat[1], range, 15));
  });
});

describe("36c2 in-scene beige", () => {
  it("the drape covers the plates/landuse mesh too, not only the terrain", () => {
    const terrain = { id: "terrain" };
    const ground = { id: "ground" };
    assert.deepEqual(drapedGroundMeshes({ terrainMesh: terrain, groundMesh: ground }),
      [terrain, ground]);
    assert.deepEqual(drapedGroundMeshes({ groundMesh: ground }), [ground]);
    assert.deepEqual(drapedGroundMeshes({}), []);
  });
});

describe("36c2 broken glyph", () => {
  const LON = 127.1;
  const LAT = 37.5;

  it("더?스타리버 next to 더샵스타리버 takes the peer name", () => {
    const peers = [{ name: "더샵스타리버", lon: LON + 0.0001, lat: LAT }];
    assert.deepEqual(repairComplexName("더?스타리버", LON, LAT, peers),
      { name: "더샵스타리버", note: null });
  });

  it("alone it drops the ? with the note", () => {
    assert.deepEqual(repairComplexName("더?스타리버", LON, LAT, []),
      { name: "더스타리버", note: BROKEN_NAME_NOTE });
  });

  it("a far peer does not donate", () => {
    const peers = [{ name: "더샵스타리버", lon: LON + 0.01, lat: LAT }];
    const out = repairComplexName("더?스타리버", LON, LAT, peers);
    assert.equal(out.name, "더스타리버");
    assert.equal(out.note, BROKEN_NAME_NOTE);
  });

  it("Hangul-only names pass through", () => {
    assert.deepEqual(repairComplexName("래미안포레스트", LON, LAT, []),
      { name: "래미안포레스트", note: null });
  });

  it("scene complex labels show the repaired name", () => {
    const area = {
      complexes: [
        { id: "a", name: "더?스타리버", lon: LON, lat: LAT },
        { id: "b", name: "더샵스타리버", lon: LON + 0.0001, lat: LAT },
      ],
      buildings: [],
      pois: [],
    };
    const items = labelItemsFor(area, { cameraDistM: 1000 });
    const titles = items.filter((i) => i.level === "complex").map((i) => i.title);
    assert.ok(titles.includes("더샵스타리버"), `titles: ${titles.join(", ")}`);
    assert.ok(!titles.some((t) => t.includes("?")), `titles: ${titles.join(", ")}`);
  });
});
