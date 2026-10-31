// Stage 29N2e — live US map inputs, Caltrain fetch choice, US sources.
//
// 1. The six corridor homes + Meta HQ laid out with the measured live
//    chrome (client rects converted to stage px, svg at 519,56):
//    six distinct visible boxes, none overlapping, each within
//    120 px of its dot.
// 2. The chat map's network choice for a US candidate set is the
//    region-us URL (even when the profile carries no currency yet,
//    as in the "I work at Meta HQ" turn).
// 3. A US find_homes row cites the US feeds, never the Korean ones.
// node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let M;
let findHomes;
let usSearchActive;
let networkUrlFor;
let NETWORK_URL;
let US_NETWORK_URL;
let SOURCE_BADGES;
let workPinLabel;
let sharedZipRent;

before(async () => {
  M = await import("../src/chatmap.js");
  ({ find_homes: findHomes, SOURCE_BADGES } = await import("../src/homes.js"));
  ({ usSearchActive, networkUrlFor, NETWORK_URL, US_NETWORK_URL } =
    await import("../src/chat/engine.js"));
  ({ workPinLabel } = await import("../src/ui/chatmap.jsx"));
  ({ sharedZipRent } = await import("../src/ui/candidate-card.jsx"));
});

// The six live homes (29N2c brief): Menlo x2, Palo Alto x2,
// Redwood City, San Carlos; Meta HQ staff, English, 921x844 stage.
const SIX = [
  ["1", "777 Hamilton", -122.1561971, 37.4795456, "us-menlo", "94025", 4100, 18],
  ["2", "1221 Willow Road", -122.1540321, 37.4746227, "us-menlo", "94025", 4261, 20],
  ["3", "344-348 Kipling Street", -122.1615958, 37.4486218, "us-st-palo-alto", "94301", 4450, 24],
  ["4", "275 Hawthorne Avenue", -122.1657664, 37.4482227, "us-st-palo-alto", "94301", 4320, 25],
  ["5", "515 Cleveland Street", -122.2344163, 37.4803242, "us-st-redwood-city", "94063", 4180, 31],
  ["6", "553 West El Camino Real", -122.2607653, 37.5080328, "us-st-san-carlos", "94070", 4600, 35],
];
const HQ = { name: "Meta HQ", lon: -122.14823, lat: 37.48485 };

function corridorHome(id, name, lon, lat, region, zip, rent, total) {
  return {
    id, name, kind: "apartment", region, lon, lat,
    build_year: null, scene: null,
    station: { station: "Town", walk_minutes: 6 },
    buckets: [{ center_m2: 60 + Number(id), range_m2: null,
      trade: null, jeonse: null,
      wolse: { count: 1, deposit: null,
        monthly: { count: 1, median_won: rent, min_won: rent, max_won: rent } } }],
    currency: "USD", country: "US",
    price: { source: "zillow_zori_zip", zip, zip_source: "osm_nearest",
      month: "2026-09", label: "Zillow ZORI" },
    commute: {
      destination: "Menlo Park",
      walk_to_station_min: { value: 6, source: "osm_graph" },
      caltrain_min: { value: 12, source: "caltrain_gtfs" },
      headway_min: { value: 20, source: "caltrain_gtfs" },
      last_mile: {
        bike_min: { value: 13, source: "osm_graph" },
        walk_min: { value: 60, source: "osm_graph" },
        shuttle_min_assumed: { value: 15, assumed: true, source: "assumed" },
      },
      total_min: { value: total, sources: ["osm_graph", "caltrain_gtfs"] },
    },
  };
}

// The live turn knew no tenure yet ("I work at Meta HQ").
function liveResult() {
  const homes = SIX.map(([id, name, lon, lat, region, zip, rent, total]) =>
    corridorHome(id, name, lon, lat, region, zip, rent, total));
  const prof = { monthlyMax: { value: 9000 }, currency: { value: "USD" } };
  return findHomes(prof, { homes },
    { sort: "commute", limit: 6, network: null, schedule: null,
      boxes: null, photos: null });
}

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;

describe("29N2e live US map: six tags share no spot", () => {
  it("921x844 with the measured live chrome: six boxes, no overlaps, near dots", () => {
    const W = 921;
    const H = 844;
    const lang = "en";
    const compact = false;
    const r = liveResult();
    assert.equal(r.candidates.length, 6);
    const map = M.buildChatMap({
      regions: { regions: [] }, network: null, tiles: [],
      green: { water: [], parks: [] },
      candidates: r.candidates, picks: [],
      workplaceStation: null, workPlace: HQ, tenure: r.tenure,
    });
    const pins = map.pins;
    assert.equal(pins.length, 6);
    // Specs exactly as ChatMap builds them (chatmap.jsx): the work
    // pill first, home tags with their compact fallback, rank 2.
    const shared = sharedZipRent(pins.map((p) => p.candidate), map.tenure);
    const mixedTenure = M.mapTenuresMixed(pins);
    const specs = [];
    if (map.workPin) {
      specs.push({ id: "work", kind: "work",
        lon: map.workPin.lon, lat: map.workPin.lat,
        w: M.tagLineWidthPx(workPinLabel(map.workPin.name, lang), 12) + 38,
        h: 26, rank: 0 });
    }
    for (const p of pins) {
      const sz = M.tagSizePx(p, map.tenure, lang,
        { compact, sharedRent: !!shared, mixedTenure });
      const shortSz = M.tagSizePx(p, map.tenure, lang,
        { compact, short: true, sharedRent: !!shared, mixedTenure });
      specs.push({ id: p.id, kind: "pill", lon: p.lon, lat: p.lat,
        w: sz.w, h: sz.h, alt: { w: shortSz.w, h: shortSz.h },
        rank: p.picked ? 1 : 2, pin: p });
    }
    // Live chrome (English capture, svg at client 519,56, 921x844):
    // filter row 531,68 351x32; legend 531,148 303x35; right
    // control column at the right edge; credit bottom-right.
    // Converted to stage px once (client minus svg origin, +4 pad).
    const SL = 519;
    const ST = 56;
    const toStage = ([l, t, w, h], pad = 4) => ({
      x: l - SL - pad, y: t - ST - pad, w: w + pad * 2, h: h + pad * 2 });
    const obstacles = [
      toStage([531, 68, 351, 32]),
      toStage([531, 148, 303, 35]),
      { x: W - 64, y: 0, w: 64, h: H },
      { x: W - 188, y: H - 26, w: 180, h: 18 },
    ];
    // Fit inset from the same chrome, as the live measure does:
    // top-left stack bottom + tallest tag, credit height, column.
    let tagH = 0;
    for (const p of pins) {
      const s = M.tagSizePx(p, map.tenure, lang, { compact });
      if (s.h > tagH) tagH = s.h;
    }
    const pad = M.fitInsetFromChrome({ W, H,
      top: (148 - ST + 35) + 4, bottom: 18, right: 64, tagH });
    const focus = [];
    if (map.workPin) focus.push(map.workPin);
    for (const p of pins) focus.push(p);
    const { laid } = M.layoutChatStage({ focus, specs, W, H, pad,
      obstacles, tenure: map.tenure, lang, compact,
      sharedRent: !!shared, mixedTenure });
    // All six homes visible as tags or card rows.
    for (const [id] of SIX) {
      const tagged = laid.some((l) => l.id === id && l.box);
      const rowed = laid.some((l) => (l.members || []).some((m) => m.id === id)
        || (l.rows || []).some((rr) => rr.id === id));
      assert.ok(tagged || rowed, `home ${id} visible as a tag or a card row`);
    }
    // Six distinct boxes, none overlapping.
    const boxes = laid.map((l) => l.box).filter(Boolean);
    const keys = new Set(boxes.map((b) => `${b.x},${b.y},${b.w},${b.h}`));
    assert.equal(keys.size, boxes.length, "no two entries share one box");
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        assert.ok(!hit(boxes[i], boxes[j]),
          `boxes ${i}/${j} do not overlap`);
      }
    }
    // Every box near its dot and inside the free area.
    const free = M.freeAreaOf(W, H, pad);
    for (const l of laid) {
      if (!l.box) continue;
      const d = Math.hypot(l.box.x + l.box.w / 2 - l.x,
        l.box.y + l.box.h / 2 - l.y);
      assert.ok(d <= 120, `${l.id} within 120 px of its dot (got ${d})`);
      assert.ok(l.box.x >= free.x + 4 && l.box.y >= free.y + 4
        && l.box.x + l.box.w <= free.x + free.w - 4
        && l.box.y + l.box.h <= free.y + free.h - 4,
      `${l.id} inside the free area`);
    }
  });
});

describe("29N2e the chat map reads the Caltrain doc for a US set", () => {
  it("a US candidate set chooses the region-us URL", () => {
    const cands = liveResult().candidates;
    assert.ok(cands.length > 0 && cands.every((c) => c.currency === "USD"));
    // The live gap: no USD on the profile yet, US homes found via
    // the Meta HQ commute — the candidates still decide US.
    assert.equal(usSearchActive({}, cands), true);
    assert.equal(usSearchActive({ currency: { value: "USD" } }, []), true);
    assert.equal(networkUrlFor({}, cands), US_NETWORK_URL);
    assert.ok(String(US_NETWORK_URL).endsWith("/data/region-us/network.json"));
  });

  it("a Korean set keeps the Seoul region URL", () => {
    const kr = [{ id: "k1", region: "songpa-gu", currency: "KRW" }];
    assert.equal(usSearchActive({}, kr), false);
    assert.equal(networkUrlFor({}, kr), NETWORK_URL);
    assert.ok(String(NETWORK_URL).endsWith("/data/region/network.json"));
  });
});

describe("29N2e US rows cite the US feeds", () => {
  it("find_homes US sources are Zillow ZORI, OSM graph, Caltrain GTFS", () => {
    for (const c of liveResult().candidates) {
      assert.deepEqual(c.sources, [
        SOURCE_BADGES.zori,
        SOURCE_BADGES.usGraph,
        SOURCE_BADGES.caltrain,
      ]);
      assert.ok(!c.sources.some((s) => /국토교통부|그래프|노선도|서울교통공사|추정/.test(s)),
        `no Korean badge on ${c.id}`);
    }
    assert.equal(SOURCE_BADGES.zori, "Zillow ZORI (ZIP typical rent, 2026-09)");
  });
});
