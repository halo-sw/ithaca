// Stage 36f: the officetel home is the officetel, the workplace scene
// has ground, one tag per real part, the phone toolbar fits.
// node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

register("./jsx-loader.mjs", import.meta.url);

import { commuteLines } from "../src/evidence.js";
import { resolveHome } from "../src/engine/scenario.js";
import { Router } from "../src/engine/graph.js";
import { NODES, WALK } from "./engine-fixture.js";
import { drapeAreaOnce, resetAreaDrapes } from "../src/area-ground.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const graph = { nodes: NODES, edges: { walk: WALK, bike: [], drive: [] } };

const OFFICE_SQUARE = [[127.0009, 37.5000], [127.0011, 37.5000],
  [127.0011, 37.5002], [127.0009, 37.5002], [127.0009, 37.5000]];
const SHOP_SQUARE = [[127.0012, 37.50044], [127.00124, 37.50044],
  [127.00124, 37.50048], [127.0012, 37.50048], [127.0012, 37.50044]];

function officetelArea() {
  return {
    area: "tiny", label: "Tiny",
    buildings: [
      { id: "w-off", origin: "joined", building: "apartments",
        name: "분당엠코헤리츠오피스텔", height_m: 35, levels: 12, area_m2: 2797,
        residential: "none", residential_source: "register",
        register: { use: "업무시설", name: "분당엠코헤리츠", sub_name: null },
        geometry: { type: "Polygon", coordinates: [OFFICE_SQUARE] } },
      { id: "w-shop", origin: "joined", building: "retail", name: "상가",
        height_m: 8, levels: 2, area_m2: 200,
        residential: "none", residential_source: "osm:retail",
        register: { use: "제2종근린생활시설", name: "상가", sub_name: null },
        geometry: { type: "Polygon", coordinates: [SHOP_SQUARE] } },
    ],
    complexes: [],
    graph,
  };
}

describe("36f contains-first home resolve", () => {
  it("a point inside a 업무시설 footprint wins whatever the residential flag", () => {
    const area = officetelArea();
    const router = new Router(area.graph);
    // P sits inside the officetel; the shop centroid is ~40 m away.
    const r = resolveHome(area, { label: "B", area: "tiny",
      complex_name: "이름없는오피스텔", lon: 127.001, lat: 37.5001 }, router);
    assert.equal(r.buildingId, "w-off");
    assert.equal(r.anchor.method, "point-in-footprint");
  });

  it("outside every footprint the officetel still counts as a dwelling", () => {
    const area = officetelArea();
    const router = new Router(area.graph);
    // ~9 m from the shop centroid, ~50 m from the officetel, inside
    // no footprint: the nearer shop is no dwelling, so the officetel wins.
    const r = resolveHome(area, { label: "B", area: "tiny",
      complex_name: "이름없는오피스텔", lon: 127.0013, lat: 37.5005 }, router);
    assert.equal(r.buildingId, "w-off");
    assert.equal(r.anchor.method, "nearest");
  });

  it("real data: demo B resolves to w465862686 (needs regenerated sim data)", { skip: !existsSync(join(HERE, "..", "..", "data", "build", "st-미금", "area.json")) }, () => {
    const area = JSON.parse(readFileSync(
      join(HERE, "..", "..", "data", "build", "st-미금", "area.json"), "utf8"));
    const router = new Router(area.graph);
    const r = resolveHome(area, { label: "B", area: "st-미금",
      complex_name: "분당 엠코 헤리츠", lon: 127.1082913, lat: 37.3493344 }, router);
    assert.equal(r.buildingId, "w465862686");
    assert.equal(r.anchor.method, "point-in-footprint");
  });
});

describe("36f second-area ground+drape is once per area id", () => {
  it("the factored helper drapes each area once (injected spy)", async () => {
    resetAreaDrapes();
    const calls = [];
    const drape = async (args) => { calls.push(args); return { ok: true, tiles: 1, zoom: 17 }; };
    const seen = [];
    const onOk = (id) => { seen.push(id); };
    await drapeAreaOnce({ areaId: "st-판교", drapeFn: drape,
      args: { areaId: "st-판교" }, onOk });
    await drapeAreaOnce({ areaId: "st-판교", drapeFn: drape,
      args: { areaId: "st-판교" }, onOk });
    await drapeAreaOnce({ areaId: "st-미금", drapeFn: drape,
      args: { areaId: "st-미금" }, onOk });
    assert.equal(calls.length, 2);
    assert.deepEqual(seen, ["st-판교", "st-미금"]);
  });
});

function bLikeRun() {
  const trip = { id: "t1", agent: "h1", day: 1, purpose: "commute",
    depart_min: 480, arrive_min: 482, minutes: 2,
    from: { label: "집" }, to: { label: "미금역" } };
  const away = { agent: "h1", day: 1, kind: "ride", label: "지하철",
    start_min: 482, end_min: 489,
    detail: { ride_minutes: 7, ride_minutes_source: "user_assumption",
      ride: { minutesTotal: 7,
        legs: [{ lineName: "수인분당선", from: "미금", to: "판교", minutes: 7,
          congestion: { valuePct: 100, source: "가정", hasData: false } }],
        transfers: [], transferMinutes: 0 } } };
  return { run: { meta: { days: 30 }, trips: [trip], aways: [away] }, trip };
}

describe("36f one tag per real part (SSR)", () => {
  let React;
  let renderToString;
  let EvidenceLine;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ EvidenceLine } = await import("../src/ui/app.jsx"));
  });

  it("a B-like run (walk + one ride, no transfer) gives 2 parts and 2 tags", () => {
    const { run, trip } = bLikeRun();
    const lines = commuteLines(run, "h1", trip, trip.depart_min);
    assert.equal(lines[0].parts.length, 2);
    assert.deepEqual(lines[0].parts.map((p) => p.label), ["걷기", "지하철"]);
    assert.deepEqual(lines[0].parts.map((p) => p.tag), ["측정", "가정값"]);
    const html = renderToString(React.createElement(EvidenceLine, { e: lines[0] }));
    assert.ok(html.includes("걷기 2분"), html);
    assert.ok(html.includes("지하철 7분"), html);
    assert.equal(html.split("ui-tag").length - 1, 2, html);
  });
});

describe("36f phone toolbar fits 390 px", () => {
  it("the toolbar CSS wraps (no clipping, no ellipsis) with >= 44 px targets", () => {
    const css = readFileSync(join(HERE, "..", "src", "ui", "ui.css"), "utf8");
    assert.ok(css.includes(".ui-tools"), "toolbar rule exists");
    assert.ok(/\.ui-tools\s*{[^}]*flex-wrap:\s*wrap/.test(css),
      "the toolbar wraps instead of clipping");
    assert.ok(!css.includes("ellipsis"), "no ellipsis anywhere near the toolbar");
    assert.ok(css.includes("min-height: 44px"), "tap targets stay >= 44 px");
  });
});
