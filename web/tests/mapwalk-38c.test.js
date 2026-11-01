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
  "남한산성입구": [127.15, 37.45],
  "단대오거리": [127.155, 37.445],
  "신흥": [127.16, 37.44],
  "수진": [127.165, 37.435],
  "모란": [127.17, 37.43],
  "야탑": [127.175, 37.42],
  "이매": [127.18, 37.41],
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
        kind: "ride", label: "",
        detail: { direction: "out", ride_minutes: 20,
          ride: { from: "미금", to: "판교",
            legs: [{ line: "shinbundang", lineName: "신분당선",
              stops: ["미금", "판교"], stopIds: [], distanceKm: 5 }] },
          ride_fallback: null, dest_walk: null } },
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
    assert.equal(activityLine(ride, 490, "ko"), "08:10 · 신분당선 미금→판교");
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
    assert.ok(/>2D</.test(withCustom), "2D option");
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

function line8Run() {
  return {
    trips: [
      { agent: "m1", day: 5, depart_min: 485, arrive_min: 490, purpose: "commute",
        to: { kind: "station", id: "s1", label: "남한산성입구" }, path: ["n1", "n2"] },
    ],
    aways: [
      { agent: "m1", day: 5, start_min: 490, end_min: 500, kind: "ride", label: "",
        detail: { direction: "out", ride_minutes: 10,
          ride: { from: "남한산성입구", to: "이매",
            legs: [
              { line: "line8", lineName: "8호선",
                stops: ["남한산성입구", "단대오거리", "신흥", "수진", "모란"],
                stopIds: [], distanceKm: 3 },
              { line: "bundang", lineName: "수인·분당선",
                stops: ["모란", "야탑", "이매"], stopIds: [], distanceKm: 2 },
            ] },
          ride_fallback: null, dest_walk: null } },
    ],
  };
}

describe("38c2 ride legs from the engine detail", () => {
  let dayTimeline;
  before(async () => {
    ({ dayTimeline } = await import("../src/mapwalk.js"));
  });

  it("splits one ride away into two leg segments by distance", () => {
    const { segments } = dayTimeline(line8Run(), {
      day: 5, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    assert.deepEqual(segments.map((s) => s.kind), ["walk", "ride", "ride"]);
    const [first, second] = segments.slice(1);
    assert.deepEqual([first.t0, first.t1], [490, 496]);
    assert.deepEqual([second.t0, second.t1], [496, 500]);
    assert.equal(first.pts.length, 5);
    assert.equal(first.line, "line8");
    assert.equal(first.label, "8호선 남한산성입구→모란");
    assert.equal(second.label, "수인·분당선 모란→이매");
  });
});

describe("38c2 walk activity lines", () => {
  let dayTimeline;
  let activityLine;
  before(async () => {
    ({ dayTimeline, activityLine } = await import("../src/mapwalk.js"));
  });

  it("reads the station walk as <first station>역까지", () => {
    const { segments } = dayTimeline(line8Run(), {
      day: 5, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    assert.equal(activityLine(segments[0], 485, "ko"), "08:05 · 걷는 중 · 남한산성입구역까지");
  });

  it("falls back to the purpose table, never a raw key", () => {
    const run = {
      trips: [
        { agent: "m1", day: 5, depart_min: 600, arrive_min: 610,
          purpose: "errand", path: ["n1", "n2"] },
      ],
      aways: [],
    };
    const { segments } = dayTimeline(run, {
      day: 5, nodeCoordsFor, stationCoord, network: NETWORK,
    });
    assert.equal(segments.length, 1);
    const ko = activityLine(segments[0], 605, "ko");
    assert.equal(ko, "10:05 · 걷는 중 · 장보기까지");
    for (const line of [ko, activityLine(segments[0], 605, "en")]) {
      assert.ok(!line.includes("[object"), `no object dump: ${line}`);
    }
    assert.ok(!ko.includes("errand") && !ko.includes("commute"), `no raw key: ${ko}`);
  });
});

describe("38c2 StayMark SSR", () => {
  let React;
  let renderToString;
  let StayMark;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ StayMark } = await import("../src/ui/mapwalk.jsx"));
  });

describe("38c3 mapWalkParams", () => {
  let mapWalkParams;
  before(async () => {
    ({ mapWalkParams } = await import("../src/mapwalk.js"));
  });

  it("maps the 1-based URL day to a 0-based dayIndex and parses t", () => {
    const r = mapWalkParams("/sim?mode=sim&custom=x&home=B&day=5&t=08:10");
    assert.equal(r.custom, "x");
    assert.equal(r.home, "B");
    assert.equal(r.dayIndex, 4);
    assert.equal(r.startMinute, 490);
  });

  it("returns null startMinute without t and dayIndex 0 without day", () => {
    const noT = mapWalkParams("/sim?mode=sim&custom=x&home=B&day=5");
    assert.equal(noT.startMinute, null);
    assert.equal(noT.dayIndex, 4);
    const noDay = mapWalkParams("/sim?mode=sim&custom=x&home=B");
    assert.equal(noDay.dayIndex, 0);
    assert.equal(noDay.startMinute, null);
  });
});

  it("draws the work square only for a work stay", () => {
    const work = renderToString(React.createElement(StayMark,
      { seg: { kind: "stay", awayKind: "work", pts: [[127.17, 37.43]] }, x: 10, y: 20,
        homeCoord: [127.1, 37.35] }));
    assert.ok(work.includes('width="12"'), "work square renders");
    const park = renderToString(React.createElement(StayMark,
      { seg: { kind: "stay", awayKind: "park", pts: [[127.17, 37.43]] }, x: 10, y: 20,
        homeCoord: [127.1, 37.35] }));
    assert.ok(!park.includes('width="12"'), "no square for a park stay");
    assert.ok(park.includes("<circle"), "grey dot instead");
    const home = renderToString(React.createElement(StayMark,
      { seg: { kind: "stay", awayKind: "home", pts: [[127.1, 37.35]] }, x: 10, y: 20,
        homeCoord: [127.1, 37.35] }));
    assert.ok(!home.includes('width="12"'), "no square on the home point");
    assert.equal(home, "", "nothing at all on the home point");
  });
});

describe("38c4 stationLabelsFor", () => {
  let dayTimeline;
  let stationLabelsFor;
  before(async () => {
    ({ dayTimeline, stationLabelsFor } = await import("../src/mapwalk.js"));
  });

  function rideSegments() {
    return dayTimeline(line8Run(), {
      day: 5, nodeCoordsFor, stationCoord, network: NETWORK,
    }).segments;
  }

  it("labels first+last stations of each leg, shared stations once", () => {
    assert.deepEqual(stationLabelsFor(rideSegments()), ["남한산성입구", "모란", "이매"]);
  });

  it("romanizes in English without Hangul", () => {
    const en = stationLabelsFor(rideSegments(), "en");
    assert.equal(en.length, 3);
    for (const t of en) assert.ok(!/[가-힣]/.test(t), `no Hangul: ${t}`);
  });
});

describe("38c4 placeLabels", () => {
  let placeLabels;
  before(async () => {
    ({ placeLabels } = await import("../src/mapwalk.js"));
  });

  it("moves the second of two items at the same point below", () => {
    const placed = placeLabels([
      { name: "a", text: "모란", x: 100, y: 100 },
      { name: "b", text: "모란", x: 100, y: 100 },
    ], () => ({ w: 60, h: 20 }));
    assert.equal(placed.length, 2);
    assert.equal(placed[0].name, "a");
    assert.equal(placed[1].name, "b");
    assert.ok(placed[1].y > placed[0].y, `below: ${placed[1].y} > ${placed[0].y}`);
  });

  it("keeps items far apart", () => {
    const placed = placeLabels([
      { name: "a", text: "남한산성입구", x: 50, y: 100 },
      { name: "b", text: "이매", x: 300, y: 100 },
    ], () => ({ w: 60, h: 20 }));
    assert.equal(placed.length, 2);
  });
});

describe("38c4 MapWalk SSR with a ready fixture", () => {
  let React;
  let renderToString;
  let MapWalk;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ MapWalk } = await import("../src/ui/mapwalk.jsx"));
  });

  function ssrFixture() {
    const line8 = ["남한산성입구", "단대오거리", "신흥", "수진", "모란"]
      .map((name, i) => ({ name, lon: 127.15 + i * 0.005, lat: 37.45 - i * 0.005 }));
    const bundang = ["모란", "야탑", "이매"]
      .map((name, i) => ({ name, lon: 127.17 + i * 0.005, lat: 37.43 - i * 0.005 }));
    return {
      saved: { scenario: { days: 30 } },
      run: {
        trips: [{ agent: "m1", day: 0, depart_min: 485, arrive_min: 490,
          purpose: "commute",
          to: { kind: "station", id: "s1", label: "남한산성입구" },
          path: ["n1", "n2"], graph_area: "a1" }],
        aways: [{ agent: "m1", day: 0, start_min: 490, end_min: 500,
          kind: "ride", label: "",
          detail: { direction: "out", ride_minutes: 10,
            ride: { from: "남한산성입구", to: "이매",
              legs: [
                { line: "line8", lineName: "8호선",
                  stops: ["남한산성입구", "단대오거리", "신흥", "수진", "모란"],
                  stopIds: [], distanceKm: 3 },
                { line: "bundang", lineName: "수인·분당선",
                  stops: ["모란", "야탑", "이매"], stopIds: [], distanceKm: 2 },
              ] },
            ride_fallback: null, dest_walk: null } }],
      },
      homeLabel: "B",
      homeEntry: { area: "a1", lon: 127.1, lat: 37.35 },
      areas: { a1: { graph: { nodes: { n1: [127.15, 37.45], n2: [127.155, 37.445] } } } },
      network: { lines: [
        { id: "line8", name: "8호선", stops: line8 },
        { id: "bundang", name: "수인·분당선", stops: bundang },
      ] },
    };
  }

  it("renders Astryx buttons, no raw controls, and station pills", () => {
    const html = renderToString(React.createElement(MapWalk,
      { url: "/sim?mode=sim&custom=c1&home=B&day=1&embed=1", lang: "ko",
        runReady: true, fixture: ssrFixture() }));
    assert.ok(html.includes("<svg"), "map renders");
    assert.ok(html.includes("astryx-button"), "Astryx buttons render");
    assert.ok(!/<button[^>]*style=/.test(html), "no raw styled button controls");
    assert.ok(html.includes("남한산성입구"), "first station pill");
    assert.ok(html.includes("모란"), "transfer pill");
    assert.ok(html.includes("이매"), "last station pill");
  });
});

describe("38c4 header CSS", () => {
  let css;
  before(async () => {
    const { readFileSync } = await import("node:fs");
    css = readFileSync(new URL("../src/ui/ui.css", import.meta.url), "utf8");
  });

  it("head wraps, title never clips", () => {
    const head = css.match(/\.ui-chat-scene-head\s*\{[^}]*\}/);
    assert.ok(head, "head rule present");
    assert.ok(head[0].includes("flex-wrap: wrap"), "head wraps");
    const title = css.match(/\.ui-chat-scene-title\s*\{[^}]*\}/);
    assert.ok(title, "title rule present");
    assert.ok(!title[0].includes("white-space: nowrap"), "title never clipped");
  });

  it("no text-overflow anywhere (existing rule)", () => {
    assert.ok(!/text-overflow/.test(css), "no text-overflow in ui.css");
  });
});

describe("38c5 placeLabels avoids obstacles", () => {
  let placeLabels;
  before(async () => {
    ({ placeLabels } = await import("../src/mapwalk.js"));
  });
  const measure = () => ({ w: 60, h: 20 });
  const item = { name: "s", text: "남한산성입구", x: 100, y: 100 };

  it("obstacle above puts the pill below", () => {
    const placed = placeLabels([item], measure,
      [{ x: 70, y: 74, w: 60, h: 20 }]);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].y, 106);
  });

  it("obstacles above and below put the pill to the right", () => {
    const placed = placeLabels([item], measure,
      [{ x: 70, y: 74, w: 30, h: 20 }, { x: 70, y: 106, w: 30, h: 20 }]);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].x, 110);
    assert.equal(placed[0].y, 90);
  });

  it("all three slots blocked drops the pill", () => {
    const placed = placeLabels([item], measure,
      [{ x: 70, y: 74, w: 60, h: 20 }, { x: 70, y: 106, w: 60, h: 20 },
        { x: 110, y: 90, w: 60, h: 20 }]);
    assert.equal(placed.length, 0);
  });
});

describe("38c5 mapwalk CSS flex", () => {
  let css;
  before(async () => {
    const { readFileSync } = await import("node:fs");
    css = readFileSync(new URL("../src/ui/ui.css", import.meta.url), "utf8");
  });

  it("ui-mapwalk has no height 100% and keeps min-height 0", () => {
    const rule = css.match(/\.ui-mapwalk\s*\{[^}]*\}/);
    assert.ok(rule, "ui-mapwalk rule present");
    assert.ok(!rule[0].includes("height: 100%"), `no full height: ${rule[0]}`);
    assert.ok(rule[0].includes("min-height: 0"), `flexes: ${rule[0]}`);
  });
});

describe("38c5 MapWalk one controls row SSR", () => {
  let React;
  let renderToString;
  let MapWalk;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ MapWalk } = await import("../src/ui/mapwalk.jsx"));
  });

  function ssrFixture() {
    const line8 = ["남한산성입구", "단대오거리", "신흥", "수진", "모란"]
      .map((name, i) => ({ name, lon: 127.15 + i * 0.005, lat: 37.45 - i * 0.005 }));
    const bundang = ["모란", "야탑", "이매"]
      .map((name, i) => ({ name, lon: 127.17 + i * 0.005, lat: 37.43 - i * 0.005 }));
    return {
      saved: { scenario: { days: 30 } },
      run: {
        trips: [{ agent: "m1", day: 0, depart_min: 485, arrive_min: 490,
          purpose: "commute",
          to: { kind: "station", id: "s1", label: "남한산성입구" },
          path: ["n1", "n2"], graph_area: "a1" }],
        aways: [{ agent: "m1", day: 0, start_min: 490, end_min: 500,
          kind: "ride", label: "",
          detail: { direction: "out", ride_minutes: 10,
            ride: { from: "남한산성입구", to: "이매",
              legs: [
                { line: "line8", lineName: "8호선",
                  stops: ["남한산성입구", "단대오거리", "신흥", "수진", "모란"],
                  stopIds: [], distanceKm: 3 },
                { line: "bundang", lineName: "수인·분당선",
                  stops: ["모란", "야탑", "이매"], stopIds: [], distanceKm: 2 },
              ] },
            ride_fallback: null, dest_walk: null } }],
      },
      homeLabel: "B",
      homeEntry: { area: "a1", lon: 127.1, lat: 37.35 },
      areas: { a1: { graph: { nodes: { n1: [127.15, 37.45], n2: [127.155, 37.445] } } } },
      network: { lines: [
        { id: "line8", name: "8호선", stops: line8 },
        { id: "bundang", name: "수인·분당선", stops: bundang },
      ] },
    };
  }

  it("range, day label and 전체 share one flex row", () => {
    const html = renderToString(React.createElement(MapWalk,
      { url: "/sim?mode=sim&custom=c1&home=B&day=1&embed=1", lang: "ko",
        runReady: true, fixture: ssrFixture() }));
    const rangeIdx = html.indexOf('type="range"');
    const fitIdx = html.indexOf("전체");
    const dayIdx = html.indexOf("1일차");
    assert.ok(rangeIdx >= 0, "slider renders");
    assert.ok(fitIdx > rangeIdx, "전체 after the slider");
    assert.ok(dayIdx > rangeIdx && dayIdx < fitIdx, "day label between slider and 전체");
    const between = html.slice(rangeIdx, fitIdx);
    assert.ok(!between.includes("</div>"), "one row: no closing div between slider and 전체");
  });
});

describe("38c5 SceneFrame labels", () => {
  let React;
  let renderToString;
  let SceneFrame;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SceneFrame } = await import("../src/ui/chat.jsx"));
  });

  function withLang(lang, fn) {
    const prev = globalThis.window;
    const kept = {};
    globalThis.window = {
      location: { search: lang === "en" ? "?lang=en" : "?lang=ko" },
      localStorage: {
        getItem: () => kept["ithaca.lang"] ?? null,
        setItem: (k, v) => { kept[k] = v; },
      },
      navigator: { language: "ko-KR" },
    };
    try {
      return fn();
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  }

  it("custom= url renders 3D, 2D and 후보 지도, never 지도로", () => {
    const html = renderToString(React.createElement(SceneFrame,
      { scene: { url: "/sim?mode=sim&custom=c1&home=A&day=2&embed=1", title: "A · 2일째" },
        runReady: true, onBack: () => {}, onClose: () => {} }));
    assert.ok(/>3D</.test(html), "3D");
    assert.ok(/>2D</.test(html), "2D");
    assert.ok(html.includes("후보 지도"), "back reads 후보 지도");
    assert.ok(!html.includes("지도로"), "no 지도로");
  });

  it("English back reads Homes map", () => {
    const html = withLang("en", () => renderToString(React.createElement(SceneFrame,
      { scene: { url: "/sim?mode=sim&custom=c1&home=A&day=2&embed=1", title: "A day 2" },
        runReady: true, onBack: () => {}, onClose: () => {} })));
    assert.ok(html.includes("Homes map"), `Homes map: ${html.slice(0, 400)}`);
  });
});

describe("38c5 sceneActionLabelFor Homes map", () => {
  let sceneActionLabelFor;
  before(async () => {
    ({ sceneActionLabelFor } = await import("../src/ui/scene-chrome.js"));
  });

  it("shortens Homes map on English phones only", () => {
    assert.equal(sceneActionLabelFor("Homes map", { phone: true, lang: "en" }), "Homes");
    assert.equal(sceneActionLabelFor("Homes map", { phone: false, lang: "en" }), "Homes map");
  });
});
