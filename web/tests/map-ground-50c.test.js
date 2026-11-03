// Stage 50c — real neighbourhood geometry beneath candidate map imagery.
// node --test, no network: stubbed fetchJson for map-ground.js.
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { selectMapGroundAreaIds, loadMapGround, projectMapGround,
  mapGroundAttribution, isMapGroundAreaId, isMapGroundSectionRef,
  clearMapGroundCache, mapGroundCacheSize,
  MAP_GROUND_MAX_AREAS, MAP_GROUND_BUILDING_MPP } from "../src/map-ground.js";
import { buildChatMap } from "../src/chatmap.js";

const JAMSIL_ROAD = { id: "w1004692936", highway: "footway",
  geometry: { type: "LineString",
    coordinates: [[127.1030985, 37.5101494], [127.1032874, 37.5099475]] } };
const MAJOR_ROAD = { id: "w42", highway: "primary",
  geometry: { type: "LineString",
    coordinates: [[127.1, 37.51], [127.11, 37.515]] } };
const HOLED_POLY = { type: "Polygon", coordinates: [
  [[127.1, 37.51], [127.12, 37.51], [127.12, 37.53], [127.1, 37.53], [127.1, 37.51]],
  [[127.105, 37.515], [127.115, 37.515], [127.115, 37.525], [127.105, 37.525], [127.105, 37.515]],
] };

function stubFetch(files, opts = {}) {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const fetchJson = async (url) => {
    calls.push(url);
    active += 1;
    if (active > maxActive) maxActive = active;
    try {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.failFirst && opts.failFirst.has(url)) {
        opts.failFirst.delete(url);
        throw new Error(`${url}: 500`);
      }
      if (!(url in files)) throw new Error(`${url}: 404`);
      const v = files[url];
      if (v instanceof Error) throw v;
      return v;
    } finally {
      active -= 1;
    }
  };
  return { fetchJson, calls, maxActive: () => maxActive };
}

const AREA = (id, doc) => [`/data/${id}/area.json`, doc];

beforeEach(() => { clearMapGroundCache(); });

describe("50c area id selection", () => {
  it("maps a Jamsil station workplace to st-잠실 first", () => {
    const ids = selectMapGroundAreaIds({
      workplaces: [{ resolved: { station: "잠실" } }],
      candidates: [{ id: "h1", scene: "st-석촌" }],
      picks: [],
    });
    assert.deepEqual(ids, ["st-잠실", "st-석촌"]);
  });
  it("maps Pangyo workplace and orders picks before the rest", () => {
    const ids = selectMapGroundAreaIds({
      workplaces: [{ resolved: { station: "판교" } }],
      candidates: [{ id: "a", scene: "st-판교" }, { id: "b", scene: "st-정자" }],
      picks: ["b"],
    });
    assert.deepEqual(ids, ["st-판교", "st-정자"]);
  });
  it("keeps a US region workplace id", () => {
    const ids = selectMapGroundAreaIds({
      workplaces: [{ resolved: { region: "us-menlo", place: { name: "Meta HQ" } } }],
      candidates: [{ id: "u1", scene: "us-st-palo-alto" }],
      picks: [],
    });
    assert.deepEqual(ids, ["us-menlo", "us-st-palo-alto"]);
  });
  it("rejects traversal, URLs and blank ids", () => {
    const ids = selectMapGroundAreaIds({
      workplaces: [{ resolved: { station: "../secret" } }, { resolved: { region: "https://x/y.json" } }],
      candidates: [{ id: "a", scene: "st-강남" }, { id: "b", scene: "" },
        { id: "c", scene: null }, { id: "d" }],
      picks: [],
    });
    assert.deepEqual(ids, ["st-강남"]);
    assert.ok(!isMapGroundAreaId("st-a/b"));
    assert.ok(!isMapGroundAreaId("st-a..b"));
    assert.ok(isMapGroundAreaId("us-st-palo-alto"));
  });
  it("dedupes and caps at 8 areas", () => {
    const cands = Array.from({ length: 10 },
      (_, i) => ({ id: `h${i}`, scene: `st-동${i}` }));
    const ids = selectMapGroundAreaIds({ workplaces: [], candidates: cands, picks: [] });
    assert.equal(ids.length, MAP_GROUND_MAX_AREAS);
    assert.equal(new Set(ids).size, ids.length);
  });
  it("rejects non-basename section refs", () => {
    assert.ok(isMapGroundSectionRef("area.buildings.json"));
    assert.ok(!isMapGroundSectionRef("../area.json"));
    assert.ok(!isMapGroundSectionRef("https://x/area.json"));
  });
});

describe("50c loader resolves only roads/buildings/landuse", () => {
  const FRESH = Object.fromEntries([
    AREA("st-잠실", { roads: [JAMSIL_ROAD, MAJOR_ROAD],
      buildings: { $ref: "area.buildings.json" },
      landuse: [
        { id: "w1", kind: "natural:water", geometry: HOLED_POLY },
        { id: "w2", kind: "leisure:park",
          geometry: { type: "Polygon", coordinates: [HOLED_POLY.coordinates[0]] } },
        { id: "w3", kind: "landuse:commercial",
          geometry: { type: "Polygon", coordinates: [HOLED_POLY.coordinates[0]] } },
        { id: "w4", kind: "landuse:grass", geometry: null },
        { id: "w5", kind: "landuse:forest",
          geometry: { type: "LineString", coordinates: [[0, 0]] } },
      ],
      graph: { nodes: [1] } }),
    ["/data/st-잠실/area.buildings.json", [
      { id: "reg:11-22", origin: "register", geometry: HOLED_POLY },
      { id: "w9", origin: "osm",
        geometry: { type: "MultiPolygon", coordinates: [[HOLED_POLY.coordinates[0]]] } },
      { id: "bad", origin: "osm",
        geometry: { type: "Polygon", coordinates: [[[999, 37.5], [999.1, 37.5], [999.1, 37.6]]] } },
    ]]]);
  it("loads roads+buildings+landuse, never graph or trees", async () => {
    const s = stubFetch(FRESH);
    const g = await loadMapGround(s.fetchJson, ["st-잠실"]);
    assert.deepEqual(g.ids, ["st-잠실"]);
    assert.equal(g.roads.length, 2);
    assert.equal(g.buildings.length, 2);
    assert.equal(g.water.length, 1);
    assert.equal(g.parks.length, 1);
    assert.equal(g.hasRegister, true);
    assert.ok(s.calls.every((u) => !u.includes("graph") && !u.includes("tree")
      && !u.includes("poi") && u.startsWith("/data/st-잠실/")));
    assert.ok(s.calls.some((u) => u.endsWith("area.buildings.json")));
  });
  it("a failed building file still preserves roads", async () => {
    const files = Object.fromEntries([
      AREA("st-강남", { roads: [JAMSIL_ROAD],
        buildings: { $ref: "area.buildings.json" }, landuse: [] }),
      ["/data/st-강남/area.buildings.json", new Error("500")],
    ]);
    const g = await loadMapGround(stubFetch(files).fetchJson, ["st-강남"]);
    assert.deepEqual(g.ids, ["st-강남"]);
    assert.equal(g.roads.length, 1);
    assert.equal(g.buildings.length, 0);
  });
  it("a missing area keeps the other successful areas", async () => {
    const files = Object.fromEntries([AREA("st-판교",
      { roads: [MAJOR_ROAD], buildings: [], landuse: [] })]);
    const g = await loadMapGround(stubFetch(files).fetchJson,
      ["st-판교", "st-없는곳"]);
    assert.deepEqual(g.ids, ["st-판교"]);
    assert.equal(g.roads.length, 1);
  });
  it("dedupes overlapping areas by source/id", async () => {
    const files = Object.fromEntries([
      AREA("st-a", { roads: [JAMSIL_ROAD], buildings: [], landuse: [] }),
      AREA("st-b", { roads: [{ ...JAMSIL_ROAD }], buildings: [], landuse: [] }),
    ]);
    // st-a/st-b are not valid ids; use valid ones with shared OSM road.
    const v = Object.fromEntries([
      AREA("st-석촌", { roads: [JAMSIL_ROAD], buildings: [], landuse: [] }),
      AREA("st-송파", { roads: [{ ...JAMSIL_ROAD }], buildings: [], landuse: [] }),
    ]);
    assert.equal(Object.keys(files).length, 2);
    const g = await loadMapGround(stubFetch(v).fetchJson, ["st-석촌", "st-송파"]);
    assert.deepEqual(g.ids, ["st-석촌", "st-송파"]);
    assert.equal(g.roads.length, 1);
  });
  it("bounds concurrency to 3 fetches", async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `st-곳${i}`);
    const files = Object.fromEntries(ids.map((id) => AREA(id,
      { roads: [], buildings: [], landuse: [] })));
    const s = stubFetch(files, { delayMs: 5 });
    await loadMapGround(s.fetchJson, ids);
    assert.ok(s.maxActive() <= 3, `maxActive=${s.maxActive()}`);
    assert.equal(s.calls.length, 6);
  });
  it("failed loads are not cached: a retry fetches again", async () => {
    const files = Object.fromEntries([AREA("st-재시도",
      { roads: [JAMSIL_ROAD], buildings: [], landuse: [] })]);
    const failFirst = new Set(["/data/st-재시도/area.json"]);
    const s = stubFetch(files, { failFirst });
    const g1 = await loadMapGround(s.fetchJson, ["st-재시도"]);
    assert.deepEqual(g1.ids, []);
    const g2 = await loadMapGround(s.fetchJson, ["st-재시도"]);
    assert.deepEqual(g2.ids, ["st-재시도"]);
    assert.equal(s.calls.filter((u) => u === "/data/st-재시도/area.json").length, 2);
  });
  it("the promise cache holds at most 12 areas", async () => {
    const ids = Array.from({ length: 13 }, (_, i) => `st-캐시${i}`);
    const files = Object.fromEntries(ids.map((id) => AREA(id,
      { roads: [], buildings: [], landuse: [] })));
    const s = stubFetch(files);
    await loadMapGround(s.fetchJson, ids.slice(0, 8));
    await loadMapGround(s.fetchJson, ids.slice(8));
    assert.ok(mapGroundCacheSize() <= 12);
    const n = s.calls.length;
    await loadMapGround(s.fetchJson, [ids[0]]);
    assert.ok(s.calls.length > n, "evicted area refetches");
  });
});

describe("50c projection clips to the viewport", () => {
  const toXY = (lon, lat) => [(lon - 127) * 1000, (lat - 37) * 1000];
  const JAMSIL_VIEW = [127.09, 37.5, 127.12, 37.52];
  const FAR_VIEW = [128.9, 38.5, 129.0, 38.6];
  async function jamsilGround() {
    const files = Object.fromEntries([
      AREA("st-잠실", { roads: [JAMSIL_ROAD, MAJOR_ROAD],
        buildings: [{ id: "reg:1", origin: "register", geometry: HOLED_POLY }],
        landuse: [{ id: "w1", kind: "natural:water", geometry: HOLED_POLY }] }),
    ]);
    return loadMapGround(stubFetch(files).fetchJson, ["st-잠실"]);
  }
  it("projects one combined path per layer with nonzero winding and keeps holes", async () => {
    const g = await jamsilGround();
    const p = projectMapGround(g, toXY, JAMSIL_VIEW, 4);
    for (const k of ["water", "parks", "buildings", "major", "minor"]) {
      assert.equal(typeof p[k], "string");
    }
    assert.ok(p.water.includes("M") && p.water.includes("Z"));
    assert.equal(p.minor.split("M").length - 1, 1, "one footway subpath");
    assert.equal(p.major.split("M").length - 1, 1, "one major subpath");
    assert.ok(p.buildings.length > 0, "close-up shows footprints");
    // Hole ring must wind opposite the outer ring (nonzero keeps the hole).
    const signed = (ring) => {
      let s = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        s += a[0] * b[1] - b[0] * a[1];
      }
      return s / 2;
    };
    const waterRings = g.water[0].rings;
    assert.equal(waterRings.length, 2);
    assert.ok(Math.sign(signed(waterRings[0])) !== Math.sign(signed(waterRings[1])),
      "hole winds opposite outer");
  });
  it("overlapping distinct exteriors keep nonzero winding in the overlap", async () => {
    const overlap = (rings) => {
      const signed = (ring) => {
        let s = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          s += a[0] * b[1] - b[0] * a[1];
        }
        return s / 2;
      };
      return Math.sign(signed(rings[0])) + Math.sign(signed(rings[1]));
    };
    const files = Object.fromEntries([
      AREA("st-겹침", { roads: [],
        buildings: [
          { id: "a", origin: "osm", geometry: { type: "Polygon",
            coordinates: [[[127.1, 37.51], [127.12, 37.51], [127.12, 37.53], [127.1, 37.53], [127.1, 37.51]]] } },
          { id: "b", origin: "osm", geometry: { type: "Polygon",
            coordinates: [[[127.105, 37.515], [127.125, 37.515], [127.125, 37.535], [127.105, 37.535], [127.105, 37.515]]] } },
        ], landuse: [] }),
    ]);
    const src = files["/data/st-겹침/area.json"].buildings.map((b) => b.geometry);
    const snapshot = JSON.stringify(src);
    const g = await loadMapGround(stubFetch(files).fetchJson, ["st-겹침"]);
    assert.equal(g.buildings.length, 2);
    assert.equal(JSON.stringify(src), snapshot, "source geometry not mutated");
    const both = [...g.buildings[0].rings, ...g.buildings[1].rings];
    assert.equal(overlap(both), 2, "overlap sums to nonzero, not an evenodd hole");
  });
  it("MultiPolygon exteriors share winding", async () => {
    const files = Object.fromEntries([
      AREA("st-모음", { roads: [], buildings: [
        { id: "m", origin: "osm", geometry: { type: "MultiPolygon", coordinates: [
          [[[127.1, 37.51], [127.11, 37.51], [127.11, 37.52], [127.1, 37.52], [127.1, 37.51]]],
          [[[127.11, 37.51], [127.1, 37.51], [127.1, 37.52], [127.11, 37.52], [127.11, 37.51]]],
        ] } },
      ], landuse: [] }),
    ]);
    const g = await loadMapGround(stubFetch(files).fetchJson, ["st-모음"]);
    assert.equal(g.buildings.length, 1);
    const signed = (ring) => {
      let s = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        s += a[0] * b[1] - b[0] * a[1];
      }
      return s / 2;
    };
    const [r0, r1] = g.buildings[0].rings;
    assert.ok(Math.sign(signed(r0)) === Math.sign(signed(r1)), "exteriors share winding");
  });
  it("a failed building section is retried on next load while roads persist", async () => {
    const files = Object.fromEntries([
      AREA("st-재건", { roads: [JAMSIL_ROAD],
        buildings: { $ref: "area.buildings.json" }, landuse: [] }),
      ["/data/st-재건/area.buildings.json", [
        { id: "b1", origin: "osm", geometry: { type: "Polygon",
          coordinates: [[[127.1, 37.51], [127.11, 37.51], [127.11, 37.52], [127.1, 37.52], [127.1, 37.51]]] } },
      ]],
    ]);
    let builds = 0;
    const base = stubFetch(files);
    const fetchJson = async (url) => {
      if (url === "/data/st-재건/area.buildings.json" && builds === 0) {
        builds += 1;
        throw new Error(`${url}: 500`);
      }
      return base.fetchJson(url);
    };
    const g1 = await loadMapGround(fetchJson, ["st-재건"]);
    assert.equal(g1.roads.length, 1, "roads preserved on failed section");
    assert.equal(g1.buildings.length, 0);
    const g2 = await loadMapGround(fetchJson, ["st-재건"]);
    assert.equal(g2.roads.length, 1, "roads still available on retry");
    assert.equal(g2.buildings.length, 1, "retry loads the failed section");
  });
  it("omits buildings at wide scale but keeps roads/parks/water", async () => {
    const g = await jamsilGround();
    const p = projectMapGround(g, toXY, JAMSIL_VIEW, MAP_GROUND_BUILDING_MPP + 100);
    assert.equal(p.buildings, "");
    assert.ok(p.minor.length > 0 && p.water.length > 0);
  });
  it("excludes distant features outside the viewport", async () => {
    const g = await jamsilGround();
    const p = projectMapGround(g, toXY, FAR_VIEW, 4);
    assert.deepEqual(p, { water: "", parks: "", buildings: "", major: "", minor: "" });
    assert.equal(mapGroundAttribution(g, FAR_VIEW).hasGround, false);
    const near = mapGroundAttribution(g, JAMSIL_VIEW);
    assert.equal(near.hasGround, true);
    assert.equal(near.hasRegister, true);
  });
  it("buildChatMap passes ground through, defaulting to empty", () => {
    const withGround = buildChatMap({ regions: { regions: [] }, network: null,
      tiles: [], green: null, ground: { ids: ["st-잠실"] },
      candidates: [], picks: [] });
    assert.deepEqual(withGround.ground, { ids: ["st-잠실"] });
    const without = buildChatMap({ regions: { regions: [] }, network: null,
      tiles: [], green: null, candidates: [], picks: [] });
    assert.equal(without.ground, null);
  });
});
