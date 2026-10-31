// Stage 29N2a — the US search covers the Caltrain corridor:
// one region set, a spread-out first page, Caltrain commute on cards,
// the Caltrain line on the map. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { usRegionsForProfile, isUsProfile } from "../src/consult/tools-search.js";
import { createUsHomesLoader } from "../src/consult/server.js";
import { find_homes, corridorOf, caltrainBreakdownText,
  CALTRAIN_SHUTTLE_LINE } from "../src/homes.js";
import { US_REGION_IDS } from "../src/places-us.js";
import { usAreaLabel, regionsForNames } from "../src/region-names.js";

register("./jsx-loader.mjs", import.meta.url);

let React;
let renderToString;
let ChatMap;
let M;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ ChatMap } = await import("../src/ui/chatmap.jsx"));
  M = await import("../src/chatmap.js");
});

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

const USD_PROFILE = { currency: { value: "USD" } };

describe("29N2a one US region set", () => {
  it("usRegionsForProfile returns all eight corridor ids, us-menlo first", () => {
    assert.deepEqual(usRegionsForProfile(USD_PROFILE), [...US_REGION_IDS]);
    assert.equal(US_REGION_IDS.length, 8);
    assert.equal(US_REGION_IDS[0], "us-menlo");
  });

  it("isUsProfile is true for any us-st-* region", () => {
    assert.equal(isUsProfile(USD_PROFILE, null), true);
    assert.equal(isUsProfile({}, ["us-st-palo-alto"]), true);
    assert.equal(isUsProfile({}, ["songpa-gu"]), false);
  });

  it("town words resolve to their station area, Belle Haven to us-menlo", () => {
    assert.deepEqual(regionsForNames(["Palo Alto"]), ["us-st-palo-alto"]);
    assert.deepEqual(regionsForNames(["팔로알토"]), ["us-st-palo-alto"]);
    assert.deepEqual(regionsForNames(["Redwood City"]), ["us-st-redwood-city"]);
    assert.deepEqual(regionsForNames(["Belle Haven"]), ["us-menlo"]);
    assert.deepEqual(regionsForNames(["벨헤이븐"]), ["us-menlo"]);
  });

  it("area labels read Palo Alto / 팔로알토", () => {
    assert.equal(usAreaLabel("us-st-palo-alto", "en"), "Palo Alto");
    assert.equal(usAreaLabel("us-st-palo-alto", "ko"), "팔로알토");
    assert.equal(usAreaLabel("us-st-redwood-city", "en"), "Redwood City");
    assert.equal(usAreaLabel("us-menlo", "ko"), "벨헤이븐");
  });
});

describe("29N2a the US loader reads the whole set", () => {
  it("concatenates area files and skips a missing one", async () => {
    const docs = {
      "homes/us-menlo.json": { homes: [{ id: "m1", region: "us-menlo" }] },
      "homes/us-st-palo-alto.json": { homes: [{ id: "p1", region: "us-st-palo-alto" },
        { id: "p2", region: "us-st-palo-alto" }] },
    };
    const read = async (kind, rel) => {
      if (!Object.hasOwn(docs, rel)) throw new Error(`missing ${rel}`);
      return JSON.stringify(docs[rel]);
    };
    const homes = await createUsHomesLoader(read)();
    assert.deepEqual(homes.map((h) => h.id), ["m1", "p1", "p2"]);
  });
});

// 12 fake homes over 4 areas (3 each), commute totals interleaved so a
// pure-commute page would take all of areas A and B.
const AREAS4 = ["us-menlo", "us-st-palo-alto", "us-st-redwood-city", "us-st-belmont"];

function corridorHome(id, region, rent, zip, total) {
  return {
    id, name: `Home ${id}`, kind: "아파트", region,
    lon: -122.15, lat: 37.47, build_year: null, scene: null,
    station: { station: "Town", walk_minutes: 6 },
    buckets: [{ center_m2: null, range_m2: null, trade: null, jeonse: null,
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

function twelveHomes() {
  const homes = [];
  const totals = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  totals.forEach((total, i) => {
    homes.push(corridorHome(`h${i + 1}`, AREAS4[i % 4],
      3800 + i * 50, `94${300 + (i % 4)}`, total));
  });
  return homes;
}

const BERKELEY_PROFILE = { tenure: { value: "wolse" },
  monthlyMax: { value: 6000 }, currency: { value: "USD" } };

describe("29N2a ranking + a spread-out first page", () => {
  it("first page of 6 has at most 2 per area, in commute order", () => {
    const r = find_homes(BERKELEY_PROFILE, { homes: twelveHomes() },
      { sort: "commute", limit: 6, regions: [...AREAS4] });
    assert.equal(r.candidates.length, 6);
    const counts = new Map();
    for (const c of r.candidates) counts.set(c.region, (counts.get(c.region) || 0) + 1);
    for (const n of counts.values()) assert.ok(n <= 2, "at most 2 per area");
    assert.ok(counts.size >= 3, "spans Belle Haven + several towns");
    const mins = r.candidates.map((c) => c.corridor_min);
    assert.deepEqual([...mins].sort((a, b) => a - b), mins, "commute-sorted within the rule");
  });

  it("show more (limit 12) continues in pure commute order", () => {
    const r = find_homes(BERKELEY_PROFILE, { homes: twelveHomes() },
      { sort: "commute", limit: 12, regions: [...AREAS4] });
    const mins = r.candidates.map((c) => c.corridor_min);
    assert.deepEqual(mins, [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
  });

  it("one area stays in pure commute order (no spread)", () => {
    const homes = [30, 20, 10].map((total, i) =>
      corridorHome(`m${i}`, "us-menlo", 3800 + i, "94025", total));
    const r = find_homes(BERKELEY_PROFILE, { homes },
      { sort: "commute", limit: 6, regions: ["us-menlo"] });
    assert.deepEqual(r.candidates.map((c) => c.id), ["m2", "m1", "m0"]);
  });

  it("the budget filter uses each home's own ZIP rent", () => {
    const homes = [
      corridorHome("cheap", "us-menlo", 3800, "94025", 18),
      corridorHome("mid", "us-st-palo-alto", 4261, "94301", 41),
      corridorHome("far", "us-st-sunnyvale", 4600, "94086", 55),
    ];
    const r = find_homes({ tenure: { value: "wolse" }, monthlyMax: { value: 4300 } },
      { homes }, { sort: "commute", limit: 6, regions: [...AREAS4] });
    assert.deepEqual(r.candidates.map((c) => c.id), ["cheap", "mid"]);
  });

  it("US results carry area, breakdown, zip and rent source", () => {
    const r = find_homes(BERKELEY_PROFILE,
      { homes: [corridorHome("p1", "us-st-palo-alto", 4261, "94301", 41)] },
      { sort: "commute", limit: 6, regions: ["us-st-palo-alto"] });
    const c = r.candidates[0];
    assert.equal(c.area_label, "Palo Alto");
    assert.equal(c.area_label_ko, "팔로알토");
    assert.equal(c.zip, "94301");
    assert.equal(c.rent_source, "Zillow ZORI");
    assert.equal(c.corridor_min, 41);
    assert.ok(c.commute_breakdown.en.includes("Caltrain 41 min"));
  });
});

describe("29N2a card text helpers", () => {
  const parts = corridorOf(corridorHome("p1", "us-st-palo-alto", 4261, "94301", 41));

  it("English breakdown reads walk + wait + train + bike", () => {
    assert.equal(caltrainBreakdownText(parts, "en"),
      "Caltrain 41 min · walk 6 + wait 10 + train 12 + bike 13");
  });

  it("Korean breakdown reads 걷기 + 대기 + 열차 + 자전거", () => {
    assert.equal(caltrainBreakdownText(parts, "ko"),
      "칼트레인 41분 · 걷기 6 + 대기 10 + 열차 12 + 자전거 13");
  });

  it("the shuttle line stays an assumption in both languages", () => {
    assert.ok(CALTRAIN_SHUTTLE_LINE.en.includes("(assumed)"));
    assert.equal(CALTRAIN_SHUTTLE_LINE.en,
      "or Meta shuttle from Menlo Park Stn (assumed)");
    assert.equal(CALTRAIN_SHUTTLE_LINE.ko, "또는 멘로파크역에서 메타 셔틀(가정)");
  });
});

// Palo Alto + Redwood City pins from different ZIPs, the Caltrain line
// doc (no colour — the map owns Caltrain red), Meta HQ as the workplace.
const PA = { lon: -122.1597, lat: 37.4410 };
const RW = { lon: -122.2317, lat: 37.4872 };

function corridorMap() {
  const network = { lines: [{ id: "caltrain", name: "Caltrain",
    stops: [
      { id: "caltrain:palo_alto", key: "Palo Alto", name: "Palo Alto",
        lon: PA.lon, lat: PA.lat },
      { id: "caltrain:redwood_city", key: "Redwood City", name: "Redwood City",
        lon: RW.lon, lat: RW.lat },
    ] }] };
  const mk = (id, region, zip, rent, base, total) => ({
    id, name: `Home ${id}`, lon: base.lon + 0.0006, lat: base.lat + 0.0004,
    currency: "USD", country: "US", region,
    corridor_min: total,
    commute: { walk: { known: true, station: "Town", minutes: 6 },
      ride: { known: false } },
    price: { source: "zillow_zori_zip", zip, month: "2026-09" },
    tenures: [{ tenure: "monthly", median_won: rent, currency: "USD" }],
  });
  return M.buildChatMap({
    regions: { regions: [] }, network, tiles: [], green: { water: [], parks: [] },
    candidates: [mk("pa-1", "us-st-palo-alto", "94301", 3950, PA, 41),
      mk("rw-1", "us-st-redwood-city", "94063", 4100, RW, 33)],
    picks: [], workplaceStation: null,
    workPlace: { name: "Meta HQ", lon: -122.1482, lat: 37.4849 },
    tenure: "monthly",
  });
}

describe("29N2a SSR ChatMap draws the Caltrain corridor", () => {
  it("Caltrain line in Caltrain red, station plates, priced pins, no shared note", () =>
    withLang("en", () => {
      const html = renderToString(React.createElement(ChatMap, { map: corridorMap() }));
      assert.ok(html.includes('stroke="#E31837"'), "Caltrain line path in Caltrain red");
      assert.ok(html.includes("Palo Alto Stn"), "our Palo Alto Stn label");
      assert.ok(html.includes("$3,950"), "Palo Alto pin shows its ZIP price");
      assert.ok(html.includes("$4,100"), "Redwood City pin shows its ZIP price");
      assert.ok(!html.includes("Same for every home"), "no shared-rent legend note");
    }));
});
