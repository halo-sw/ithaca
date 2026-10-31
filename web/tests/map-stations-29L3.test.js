// Stage 29L3 — one station name (ours, with 역 / Stn on a backplate),
// station labels avoid chrome, and the 회사 pill side-picks around
// station dots and label boxes.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { layoutStationLabels, stationNameWidthPx, stationLabelName,
  placeWorkplacePill } from "../src/chatmap.js";

register("./jsx-loader.mjs", import.meta.url);

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;

// The text box layoutStationLabels owns for a returned label.
const labelBox = (l) => ({ x: l.x, y: l.y - 10,
  w: stationNameWidthPx(l.name), h: 13 });

describe("29L3 station labels avoid obstacles", () => {
  it("an obstacle on the default spot moves the label or drops it, never under a box", () => {
    const stations = [{ name: "강남역", x: 200, y: 200 }];
    const tw = stationNameWidthPx("강남역");
    const obstacles = [{ x: 207, y: 196, w: tw, h: 13 }];
    const out = layoutStationLabels(stations, 640, 420, obstacles);
    for (const l of out) {
      assert.ok(!obstacles.some((o) => hit(labelBox(l), o)),
        "label box must not intersect any obstacle");
    }
    if (out.length > 0) {
      assert.ok(labelBox(out[0]).x !== 207 || labelBox(out[0]).y !== 196,
        "label moved off the covered default spot");
    }
  });

  it("labels covered on every spot are dropped", () => {
    const out = layoutStationLabels([{ name: "강남역", x: 200, y: 200 }],
      640, 420, [{ x: 0, y: 0, w: 640, h: 420 }]);
    assert.deepEqual(out, []);
  });
});

describe("29L3 station label text", () => {
  it("강남 reads 강남역 (ko) and Gangnam Stn (en); 강남역 stays 강남역", () => {
    assert.equal(stationLabelName("강남", "ko"), "강남역");
    assert.equal(stationLabelName("강남", "en"), "Gangnam Stn");
    assert.equal(stationLabelName("강남역", "ko"), "강남역");
    assert.equal(stationLabelName("강남역", "en"), "Gangnam Stn");
  });
});

describe("29L3 workplace pill side-picking", () => {
  it("picks the left side when the right side overlaps a station label box", () => {
    const placed = placeWorkplacePill(200, 200, 80, 26, 640, 420,
      [{ x: 212, y: 187, w: 80, h: 26 }]);
    assert.equal(placed.side, "left");
    assert.equal(placed.leader, null);
    assert.ok(!hit(placed.box, { x: 212, y: 187, w: 80, h: 26 }));
  });

  it("keeps the right side with a leader when every side collides", () => {
    const placed = placeWorkplacePill(200, 200, 80, 26, 640, 420,
      [{ x: 0, y: 0, w: 640, h: 420 }]);
    assert.equal(placed.side, "right");
    assert.ok(Array.isArray(placed.leader));
  });
});

describe("29L5 station names yield to the VWorld basemap", () => {
  let React;
  let renderToString;
  let ChatMap;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ ChatMap } = await import("../src/ui/chatmap.jsx"));
  });

  const render = (el) => renderToString(el);

  function cand(id, lon, lat, station) {
    return { id, n: 1, lon, lat,
      candidate: { id, name: `집${id}`, kind: "오피스텔",
        lon, lat, commute: { walk: { known: true, station, minutes: 3 } },
        tenures: [{ tenure: "jeonse", median_won: 200000000, deals: 5 }] } };
  }

  it("VWorld basemap on: dots with tooltips, no own name text", () => {
    const html = render(React.createElement(ChatMap, { map: {
      pins: [cand("1", 127.1, 37.4, "야탑")],
      workPin: { lon: 127.1, lat: 37.4005, name: "판교" },
      stations: [
        { line: "수인분당", name: "판교", lon: 127.1, lat: 37.4006 },
        { line: "수인분당", name: "야탑", lon: 127.1005, lat: 37.399 },
      ],
      regions: [], tenure: "jeonse" } }));
    assert.ok(html.includes("<title>야탑</title>"), "station dot kept with tooltip");
    assert.ok(html.includes("회사 · 판교"), "workplace pill still names its station");
    assert.ok(!html.includes(">야탑역</text>"), "no own name text over the VWorld basemap");
    assert.ok(!html.includes(">판교역</text>"), "no own name text for the workplace stop");
  });

  it("USGS basemap: our station-name text stays", () => {
    const html = render(React.createElement(ChatMap, { map: {
      pins: [cand("1", -122.419, 37.775, "Civic")],
      workPin: { lon: -122.419, lat: 37.776, name: "Powell" },
      stations: [
        { line: "BART", name: "Powell", lon: -122.419, lat: 37.7761 },
        { line: "BART", name: "Civic", lon: -122.418, lat: 37.774 },
      ],
      regions: [], tenure: "jeonse" } }));
    assert.ok(html.includes("<title>Civic</title>"), "station dot kept with tooltip");
    assert.ok(html.includes(">Civic역</text>"), "our station-name text stays on USGS");
  });
});
