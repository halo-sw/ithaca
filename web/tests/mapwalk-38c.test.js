// Stage 38c: walk on the map — pure dayTimeline/positionAt/activityLine
// plus the SceneFrame 3D|지도 toggle and MapWalk SSR smoke test.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const NODES = {
  n1: [127.1, 37.35],
  n2: [127.11, 37.35],
  n3: [127.12, 37.35],
  n4: [127.13, 37.35],
};
const STATIONS = {
  "미금": [127.12, 37.35],
  "판교": [127.14, 37.35],
};
const NETWORK = {
  lines: [{
    id: "shinbundang",
    name: "신분당선",
    stops: [
      { name: "미금", lon: 127.12, lat: 37.35 },
      { name: "판교", lon: 127.14, lat: 37.35 },
    ],
  }],
};

function fixtureRun() {
  return {
    trips: [
      { agent: "m1", day: 2, depart_min: 470, arrive_min: 480,
        purpose: "미금역", path: ["n1", "n2", "n3"] },
      { agent: "b01", day: 2, depart_min: 470, arrive_min: 480,
        purpose: "나들이", path: ["n1", "n4"] },
    ],
    aways: [
      { agent: "m1", day: 2, start_min: 480, end_min: 500,
        kind: "ride", label: "", detail: "미금→판교" },
      { agent: "m1", day: 2, start_min: 500, end_min: 1080,
        kind: "work", label: "판교 직장", detail: "" },
    ],
  };
}

const nodeCoordsFor = (id) => NODES[id] || null;
const stationCoord = (name) => STATIONS[name] || null;

describe("38c dayTimeline on a synthetic run", () => {
  let dayTimeline;
  before(async () => {
    ({ dayTimeline } = await import("../src/mapwalk.js"));
  });

  it("orders walk → ride → stay, drops unknown nodes, ignores b01", () => {
    const { segments, others } = dayTimeline(fixtureRun(), {
      day: 2, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    assert.deepEqual(segments.map((s) => s.kind), ["walk", "ride", "stay"]);
    assert.equal(segments[0].pts.length, 3);
    assert.deepEqual(segments[0].pts[0], NODES.n1);
    assert.deepEqual(segments[1].pts[0], STATIONS["미금"]);
    assert.deepEqual(segments[1].pts[segments[1].pts.length - 1], STATIONS["판교"]);
    assert.ok(!JSON.stringify(segments).includes("127.13"), "background agent leg ignored");
    assert.ok(Array.isArray(others), "others list present");
  });
});

describe("38c positionAt", () => {
  let dayTimeline;
  let positionAt;
  before(async () => {
    ({ dayTimeline, positionAt } = await import("../src/mapwalk.js"));
  });

  it("sits halfway along the walk by distance at 07:55", () => {
    const { segments } = dayTimeline(fixtureRun(), {
      day: 2, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    const at = positionAt(segments, 475);
    assert.ok(Math.abs(at.lon - NODES.n2[0]) < 1e-9, `lon ${at.lon}`);
    assert.ok(Math.abs(at.lat - NODES.n2[1]) < 1e-9, `lat ${at.lat}`);
    assert.equal(at.seg.kind, "walk");
  });

  it("stays at the workplace at 12:00", () => {
    const { segments } = dayTimeline(fixtureRun(), {
      day: 2, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    const at = positionAt(segments, 720);
    assert.equal(at.seg.kind, "stay");
    assert.deepEqual([at.lon, at.lat], STATIONS["판교"]);
  });
});

describe("38c activityLine", () => {
  let dayTimeline;
  let activityLine;
  before(async () => {
    ({ dayTimeline, activityLine } = await import("../src/mapwalk.js"));
  });

  it("formats walk / ride / stay in Korean and English", () => {
    const { segments } = dayTimeline(fixtureRun(), {
      day: 2, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    const [walk, ride, stay] = segments;
    assert.equal(activityLine(walk, 484, "ko"), "08:04 · 걷는 중 · 미금역까지");
    assert.equal(activityLine(walk, 484, "en"), "08:04 · Walking · to Migeum Stn");
    assert.equal(activityLine(ride, 490, "ko"), "08:10 · 신분당선");
    assert.equal(activityLine(ride, 490, "en"), "08:10 · Shinbundang Line");
    assert.equal(activityLine(stay, 540, "ko"), "09:00 · 판교 직장");
    const enStay = activityLine(stay, 540, "en");
    assert.ok(enStay.startsWith("09:00 · "), `stay en time ${enStay}`);
    assert.ok(!/[가-힣]/.test(enStay), `no Hangul in English: ${enStay}`);
    for (const line of [activityLine(walk, 484, "en"), activityLine(ride, 490, "en"), enStay]) {
      assert.ok(!/[가-힣]/.test(line), `no Hangul: ${line}`);
    }
  });
});

describe("38c SceneFrame toggle + MapWalk SSR", () => {
  let React;
  let renderToString;
  let SceneFrame;
  let MapWalk;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SceneFrame } = await import("../src/ui/chat.jsx"));
    ({ MapWalk } = await import("../src/ui/mapwalk.jsx"));
  });

  it("shows the 3D | 지도 toggle for custom= urls only", () => {
    const withCustom = renderToString(React.createElement(SceneFrame,
      { scene: { url: "/sim?mode=sim&custom=c1&home=A&day=2&embed=1", title: "A · 2일째" },
        runReady: true, onBack: () => {}, onClose: () => {} }));
    assert.ok(withCustom.includes("<iframe"), "default mode is 3D");
    assert.ok(withCustom.includes("aria-pressed"), "segmented control renders");
    assert.ok(/>3D</.test(withCustom), "3D option");
    assert.ok(/>지도</.test(withCustom), "지도 option");
    const tour = renderToString(React.createElement(SceneFrame,
      { scene: { url: "/tour?area=pangyo&embed=1", title: "판교 동네" },
        onBack: () => {}, onClose: () => {} }));
    assert.ok(tour.includes("<iframe"), "tour keeps the iframe");
    assert.ok(!tour.includes("aria-pressed"), "no toggle without custom=");
  });

  it("MapWalk pending on runReady renders the waiting line, no svg", () => {
    const html = renderToString(React.createElement(MapWalk,
      { url: "/sim?mode=sim&custom=c1&home=A&day=2&embed=1", lang: "ko", runReady: new Promise(() => {}) }));
    assert.ok(html.includes("지도를 준비하고 있어요…"), "waiting line");
    assert.ok(!html.includes("<svg"), "no svg while pending");
  });
});
