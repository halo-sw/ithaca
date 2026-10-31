// Stage 29M2 — the chat map frames the homes: tags stay inside the
// free area, a tight group becomes one list card, English pins read
// plainly. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "..", "src", "ui", "ui.css"), "utf8");

let React;
let renderToString;
let ChatMap;
let M;
let workPinLabel;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ ChatMap } = await import("../src/ui/chatmap.jsx"));
  M = await import("../src/chatmap.js");
  ({ workPinLabel } = await import("../src/ui/chatmap.jsx"));
});

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;

// Six homes within ~120 m (Coleman Ave / Hamilton Ave scale) plus a
// workplace ~2.5 km north-east (Meta HQ scale). USD monthly rents
// differ per home, so no shared-rent path and rows carry prices.
const US_LON = -122.1515;
const US_LAT = 37.4819;
const US_OFFS = [
  [0, 0], [0.0004, 0.0002], [0.0008, -0.0001],
  [0.0003, 0.0006], [-0.0004, 0.0003], [0.0006, 0.0005],
];
const US_RENTS = [4100, 4261, 4450, 4320, 4180, 4600];
const US_MINS = [11, 12, 13, 14, 15, 16];

function usCandidates() {
  return US_OFFS.map(([dx, dy], i) => ({
    id: `u${i + 1}`,
    name: `Home ${i + 1}`,
    lon: US_LON + dx,
    lat: US_LAT + dy,
    area_m2: 60 + i,
    currency: "USD",
    commute: { walk: { known: true, station: "Downtown", minutes: 3 },
      ride: { known: true, minutes: US_MINS[i] - 3 } },
    tenures: [{ tenure: "monthly", median_won: US_RENTS[i], currency: "USD" }],
  }));
}

const US_WORK = { name: "Meta HQ", lon: US_LON + 0.018, lat: US_LAT + 0.018 };

function usMap() {
  return M.buildChatMap({
    regions: { regions: [] },
    network: null, tiles: [], green: { water: [], parks: [] },
    candidates: usCandidates(), picks: [],
    workplaceStation: null,
    workPlace: US_WORK, tenure: "monthly",
  });
}

// Six spread homes around Gangnam plus the workplace, all jeonse.
function seoulMap() {
  const cands = [
    [127.05, 37.40, 270000000], [127.12, 37.46, 200000000],
    [127.02, 37.52, 150000000], [127.08, 37.43, 260000000],
    [127.10, 37.49, 310000000], [127.06, 37.45, 220000000],
  ].map(([lon, lat, won], i) => ({
    id: `s${i + 1}`, name: `집${i + 1}`, lon, lat, area_m2: 30 + i,
    commute: { walk: { known: true, station: "강남", minutes: 3 },
      ride: { known: true, minutes: 8 + i } },
    tenures: [{ tenure: "jeonse", median_won: won, deals: 5 }],
  }));
  return M.buildChatMap({
    regions: { regions: [] },
    network: null, tiles: [], green: { water: [], parks: [] },
    candidates: cands, picks: [],
    workplaceStation: null,
    workPlace: { name: "강남", lon: 127.09, lat: 37.47 }, tenure: "jeonse",
  });
}

function pillWidth(text, px) {
  let tw = 0;
  for (const ch of String(text || "")) tw += ch.codePointAt(0) > 0xff ? px : Math.round(px * 0.58);
  return tw;
}

// The same specs ChatMap builds: measured tag boxes + the work pill.
function stageSpecs(map, tenure, lang, compact) {
  const specs = [];
  if (map.workPin) {
    const label = workPinLabel(map.workPin.name, lang);
    specs.push({ id: "work", kind: "work",
      lon: map.workPin.lon, lat: map.workPin.lat,
      w: pillWidth(label, 12) + 38, h: 26, rank: 0 });
  }
  for (const p of map.pins) {
    const sz = M.tagSizePx(p, tenure, lang, { compact, mixedTenure: false });
    const shortSz = M.tagSizePx(p, tenure, lang, { compact, short: true, mixedTenure: false });
    specs.push({ id: p.id, kind: "pill", lon: p.lon, lat: p.lat,
      w: sz.w, h: sz.h, alt: { w: shortSz.w, h: shortSz.h },
      rank: 2, pin: p });
  }
  return specs;
}

function stageObstacles(W, H) {
  return [
    { x: 0, y: 0, w: Math.min(300, W * 0.5), h: 140 },
    { x: W - 64, y: 0, w: 64, h: H },
    { x: 0, y: H - 96, w: W, h: 96 },
  ];
}

function runStage(map, tenure, lang, W, H) {
  const compact = W <= 480;
  const focus = [];
  if (map.workPin) focus.push(map.workPin);
  for (const p of map.pins) focus.push(p);
  const pad = M.fitInsetFromChrome({ W, H, top: 140, bottom: 96, right: 64, tagH: 56 });
  return { ...M.layoutChatStage({ focus,
    specs: stageSpecs(map, tenure, lang, compact),
    W, H, pad, obstacles: stageObstacles(W, H),
    tenure, lang, compact, sharedRent: false, mixedTenure: false }), pad };
}

function withLang(lang, fn) {
  const prev = globalThis.window;
  globalThis.window = { location: { search: `?lang=${lang}`, href: "" } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
}

describe("29M2 tags stay inside the free area", () => {
  for (const [W, H] of [[640, 585], [390, 600]]) {
    it(`${W}x${H}: every box inside the free area, no overlaps`, () => {
      const { laid, pad } = runStage(usMap(), "monthly", "en", W, H);
      const free = M.freeAreaOf(W, H, pad);
      const boxes = laid.map((l) => l.box).filter(Boolean);
      assert.ok(boxes.length >= 2, "work pill + group card placed");
      for (const b of boxes) {
        assert.ok(b.x >= free.x + 4 && b.y >= free.y + 4
          && b.x + b.w <= free.x + free.w - 4
          && b.y + b.h <= free.y + free.h - 4,
        `box inside the free area: ${JSON.stringify(b)} free ${JSON.stringify(free)}`);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          assert.ok(!hit(boxes[i], boxes[j]),
            `boxes ${i}/${j} do not overlap`);
        }
      }
      const work = laid.find((l) => l.id === "work");
      assert.ok(work && work.box, "workplace pill placed");
      assert.ok(work.box.x >= 8 && work.box.y >= 8
        && work.box.x + work.box.w <= W - 8
        && work.box.y + work.box.h <= H - 8,
      `workplace keeps 8 px from every edge: ${JSON.stringify(work.box)}`);
    });
  }
});

describe("29M2 a tight group becomes one list card", () => {
  it("six US homes render as one `6 homes` card with six row buttons", () => withLang("en", () => {
    const html = renderToString(React.createElement(ChatMap, { map: usMap() }));
    assert.ok(html.includes("6 homes"), "group card header");
    const rows = [...html.matchAll(/<g[^>]*data-layer="group-row"[^>]*>/g)].map((m) => m[0]);
    assert.equal(rows.length, 6, "six row buttons");
    const ids = [...html.matchAll(/data-pin-id="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(ids)].sort(),
      ["u1", "u2", "u3", "u4", "u5", "u6"], "each row carries its pin id");
    for (const g of rows) {
      assert.ok(g.includes('role="button"'), "row is a button");
    }
    const tags = html.match(/<g[^>]*data-layer="home-pin"[^>]*>/g) || [];
    assert.equal(tags.length, 0, "no fanned single tags for grouped pins");
  }));

  it("groupTightAnchors needs 3+ anchors inside the fan radius", () => {
    const near = [
      { x: 100, y: 100 }, { x: 105, y: 102 }, { x: 98, y: 108 },
      { x: 400, y: 300 },
    ];
    const groups = M.groupTightAnchors(near, 18);
    assert.equal(groups.length, 1, "one tight group");
    assert.equal(groups[0].length, 3, "the three close anchors");
    assert.deepEqual(M.groupTightAnchors([{ x: 0, y: 0 }, { x: 5, y: 5 }], 18), [],
      "a pair never groups");
  });

  it("card rows name the number, the price when prices differ, and the commute", () => {
    assert.equal(M.groupCardHeader(6, "en"), "6 homes");
    assert.equal(M.groupCardHeader(6, "ko"), "집 6곳");
    const same = M.groupCardRows([
      { n: "1", price: "11 min to work", commute: null },
      { n: "2", price: "12 min to work", commute: null },
    ]);
    assert.deepEqual(same, ["1 · 11 min to work", "2 · 12 min to work"]);
    const mixed = M.groupCardRows([
      { n: "1", price: "₩273M", commute: "11 min" },
      { n: "2", price: "₩310M", commute: "12 min" },
    ]);
    assert.deepEqual(mixed, ["1 · ₩273M · 11 min", "2 · ₩310M · 12 min"]);
  });
});

describe("29M2 pins + workplace centre in the free area", () => {
  it("Seoul union centred within 15 %", () => {
    const W = 640;
    const H = 585;
    const map = seoulMap();
    const { fit, pad } = runStage(map, "jeonse", "ko", W, H);
    const free = M.freeAreaOf(W, H, pad);
    const pts = [...map.pins, map.workPin].map((p) => fit.toXY(p.lon, p.lat));
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    assert.ok(Math.abs(cx - (free.x + free.w / 2)) <= free.w * 0.15,
      `union centred horizontally: ${cx}`);
    assert.ok(Math.abs(cy - (free.y + free.h / 2)) <= free.h * 0.15,
      `union centred vertically: ${cy}`);
  });

  it("refitViewForBoxes pulls stray boxes back onto the stage", () => {
    const W = 640;
    const H = 585;
    const pad = M.fitInsetFromChrome({ W, H, top: 140, bottom: 96, right: 64, tagH: 56 });
    const focus = [{ lon: 127.05, lat: 37.40 }, { lon: 127.051, lat: 37.401 }];
    const fit = M.fitMapView(focus, W, H, 0.12, pad);
    const stray = [
      { x: 100, y: H - 10, w: 120, h: 52 },
      { x: 300, y: H - 8, w: 110, h: 52 },
    ];
    assert.ok(M.boxesLeaveFreeArea(stray, M.freeAreaOf(W, H, pad)),
      "stray bottom tags leave the free area");
    const next = M.refitViewForBoxes(fit, stray, focus, W, H, pad);
    for (const b of stray) {
      for (const [px, py] of [[b.x, b.y], [b.x + b.w, b.y + b.h]]) {
        const [lon, lat] = fit.toLonLat(px, py);
        const [nx, ny] = next.toXY(lon, lat);
        assert.ok(nx >= 0 && nx <= W && ny >= 0 && ny <= H,
          `drawn corner stays on stage: ${nx},${ny}`);
      }
    }
  });
});

describe("29M2 English price lines and legend", () => {
  it("a single shared tenure drops the letter in English", () => {
    const c = { tenures: [{ tenure: "jeonse", median_won: 273000000, deals: 5 }] };
    assert.equal(M.tagPriceLine(c, "jeonse", "en"), "₩273M");
    assert.equal(M.tagPriceLine(c, "jeonse", "ko"), "전 2억 7,300");
  });

  it("mixed tenures keep the 34a letters", () => {
    const c = { tenures: [
      { tenure: "jeonse", median_won: 273000000, deals: 5 },
      { tenure: "wolse", median_won: 500000, deposit_median_won: 20000000, deals: 2 },
    ] };
    assert.equal(M.tagPriceLine(c, "jeonse", "en"), "J ₩273M");
    assert.equal(M.tagPriceLine(c, "jeonse", "en", { mixedTenure: true }), "J ₩273M");
    assert.equal(M.tagPriceLine(c, "jeonse", "en", { mixedTenure: false }), "₩273M");
  });

  it("the English legend names jeonse", () => withLang("en", () => {
    const html = renderToString(React.createElement(ChatMap, { map: seoulMap() }));
    assert.ok(html.includes("jeonse"), "legend names the shared tenure");
  }));
});

describe("29M2 English station plates over VWorld", () => {
  const stationMap = () => ({
    pins: [{ id: "1", n: 1, lon: 127.1, lat: 37.4, commuteMin: 9,
      candidate: { id: "1", name: "집1", kind: "오피스텔",
        lon: 127.1, lat: 37.4,
        commute: { walk: { known: true, station: "선릉", minutes: 3 } },
        tenures: [{ tenure: "jeonse", median_won: 200000000, deals: 5 }] } }],
    workPin: { lon: 127.1, lat: 37.4005, name: "판교" },
    stations: [
      { line: "2호선", name: "선릉", lon: 127.1005, lat: 37.3995 },
      { line: "수인분당", name: "판교", lon: 127.1, lat: 37.4006 },
    ],
    regions: [], tenure: "jeonse",
  });

  it("English draws `… Stn` plates over the VWorld basemap", () => withLang("en", () => {
    const html = renderToString(React.createElement(ChatMap, { map: stationMap() }));
    assert.ok(/Stn<\/text>/.test(html), "English station plate text");
  }));

  it("Korean keeps dots only over the VWorld basemap", () => withLang("ko", () => {
    const html = renderToString(React.createElement(ChatMap, { map: stationMap() }));
    assert.ok(!/Stn<\/text>/.test(html), "no English plates in Korean");
    assert.ok(!/>선릉역<\/text>/.test(html), "no Korean plates over VWorld");
  }));
});

describe("29M2 phone chip row clears the close button", () => {
  it("the row reserves the close width + a gap and scrolls inside itself", () => {
    const row = css.match(/\.ui-chatmap-filters\s*\{[^}]*\}/);
    assert.ok(row, "chip row rule present");
    assert.ok(row[0].includes("overflow-x: auto"), "scrolls sideways");
    assert.ok(row[0].includes("flex-wrap: nowrap"), "never wraps");
    assert.ok(row[0].includes("--ds-s-40") && row[0].includes("--ds-s-8"),
      "reserves the close-button width plus a gap");
    const chip = css.match(/\.ui-chatmap-chip\s*\{[^}]*\}/);
    assert.ok(chip && chip[0].includes("white-space: nowrap"), "chips never cut");
    assert.ok(!/\.ui-chatmap-chip\s*\{[^}]*text-overflow/.test(css), "no ellipsis on chips");
  });
});

// Six homes around Sadang-dong spread over ~3 km, the workplace at
// the west edge of the set (all jeonse, like the Seoul capture).
function seoulWestMap() {
  const cands = [
    [126.95, 37.47, 270000000], [126.96, 37.48, 200000000],
    [126.97, 37.46, 150000000], [126.98, 37.475, 260000000],
    [126.965, 37.49, 310000000], [126.975, 37.465, 220000000],
  ].map(([lon, lat, won], i) => ({
    id: `w${i + 1}`, name: `집${i + 1}`, lon, lat, area_m2: 30 + i,
    commute: { walk: { known: true, station: "사당", minutes: 3 },
      ride: { known: true, minutes: 8 + i } },
    tenures: [{ tenure: "jeonse", median_won: won, deals: 5 }],
  }));
  return M.buildChatMap({
    regions: { regions: [] },
    network: null, tiles: [], green: { water: [], parks: [] },
    candidates: cands, picks: [],
    workplaceStation: null,
    workPlace: { name: "구로", lon: 126.945, lat: 37.475 }, tenure: "jeonse",
  });
}

describe("29M2b one neighbourhood = one card at the real stage size", () => {
  for (const [W, H] of [[889, 810], [390, 600]]) {
    it(`${W}x${H}: six US homes within 250 m + workplace 2 km NE render as one card`, () => {
      const { laid } = runStage(usMap(), "monthly", "en", W, H);
      const groups = laid.filter((l) => l.kind === "group");
      assert.equal(groups.length, 1, "exactly one card");
      assert.equal(groups[0].rows.length, 6, "six rows");
      assert.equal(laid.filter((l) => l.kind === "pill").length, 0,
        "no single tags for grouped pins");
    });
  }

  it("889x810 Seoul-like set: pins + workplace union within 12 % of the free-area centre", () => {
    const W = 889;
    const H = 810;
    const map = seoulWestMap();
    const { fit, pad } = runStage(map, "jeonse", "ko", W, H);
    const free = M.freeAreaOf(W, H, pad);
    const pts = [...map.pins, map.workPin].map((p) => fit.toXY(p.lon, p.lat));
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    assert.ok(Math.abs(cx - (free.x + free.w / 2)) <= free.w * 0.12,
      `union centred horizontally: ${cx} vs ${free.x + free.w / 2}`);
    assert.ok(Math.abs(cy - (free.y + free.h / 2)) <= free.h * 0.12,
      `union centred vertically: ${cy} vs ${free.y + free.h / 2}`);
  });

  for (const [W, H] of [[889, 810], [390, 600]]) {
    it(`${W}x${H}: every box keeps 8 px from each stage edge`, () => {
      for (const [map, tenure, lang] of [
        [usMap(), "monthly", "en"], [seoulMap(), "jeonse", "ko"],
        [seoulWestMap(), "jeonse", "ko"]]) {
        const { laid } = runStage(map, tenure, lang, W, H);
        for (const l of laid) {
          const b = l.box;
          if (!b) continue;
          assert.ok(b.x >= 8 && b.y >= 8
            && b.x + b.w <= W - 8 && b.y + b.h <= H - 8,
          `${l.id} keeps 8 px from every edge: ${JSON.stringify(b)}`);
        }
      }
    });
  }
});

describe("29M2b legend items never break inside", () => {
  it("SSR Korean legend: each item is one nowrap element", () => withLang("ko", () => {
    const html = renderToString(React.createElement(ChatMap, { map: seoulMap() }));
    const legend = html.match(/<div[^>]*ui-chatmap-legend[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(legend, "legend present");
    const items = [...legend[1].matchAll(
      /<span[^>]*class="ui-chatmap-legend-item"[^>]*>([^<]*)<\/span>/g)]
      .map((m) => m[1]);
    assert.ok(items.length >= 3, `legend has one element per item: ${items.length}`);
    assert.ok(items.some((t) => t.includes("■ 회사")), "work item present");
    assert.ok(items.some((t) => t.includes("지하철")), "subway item present");
    const rule = css.match(/\.ui-chatmap-legend-item\s*\{[^}]*\}/);
    assert.ok(rule && rule[0].includes("white-space: nowrap"),
      "legend items never break inside");
  }));
});
