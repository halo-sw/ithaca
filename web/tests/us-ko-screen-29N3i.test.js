// Stage 29N3i — US homes on the Korean screen: no fake walk-direct
// alt, one language per sort note, $3,541 form, Korean station names.
// node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { find_homes, usCommuteBest } from "../src/homes.js";
import { stationLabelName } from "../src/chatmap.js";
import { stationRideLabel } from "../src/labels3d.js";
import { fmtMoney } from "../src/money/currency.js";
import { REPORT_PROMPT } from "../src/consult/report.js";

register("./jsx-loader.mjs", import.meta.url);

let commuteRowLine;
before(async () => {
  ({ commuteRowLine } = await import("../src/ui/candidate-card.jsx"));
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

const META_WORK = [{ resolved: { place: { id: "meta-hq", name: "Meta HQ" } } }];
const PROFILE = { tenure: { value: "wolse" }, monthlyMax: { value: 6000 },
  currency: { value: "USD" }, workplaces: { value: META_WORK } };

// Palo Alto station-box home carrying a stale box work_targets.meta-hq
// (walk 11.2 snapped outside the box) with direct leaves bike 24.8 /
// walk 79.5 and Caltrain total 37.
function bogusWorkHome(id) {
  return {
    id, name: `Home ${id}`, kind: "아파트", region: "us-st-palo-alto",
    lon: -122.15, lat: 37.47, build_year: null, scene: null,
    station: { station: "Town", walk_minutes: 8 },
    work_targets: { "meta-hq": { walk_minutes: 11.2, bike_minutes: 3.5 } },
    buckets: [{ center_m2: null, range_m2: null, trade: null, jeonse: null,
      wolse: { count: 1, deposit: null,
        monthly: { count: 1, median_won: 3950, min_won: 3950, max_won: 3950 } } }],
    currency: "USD", country: "US",
    price: { source: "zillow_zori_zip", zip: "94301", zip_source: "osm_nearest",
      month: "2026-09", label: "Zillow ZORI" },
    commute: {
      destination: "Menlo Park",
      best: { mode: "bike", min: 24.8 },
      bike_direct_min: { value: 24.8, source: "estimate" },
      walk_direct_min: { value: 79.5, source: "estimate" },
      walk_to_station_min: { value: 8, source: "osm_graph" },
      caltrain_min: { value: 3, source: "caltrain_gtfs" },
      headway_min: { value: 16, source: "caltrain_gtfs" },
      last_mile: {
        bike_min: { value: 18, source: "osm_graph" },
        walk_min: { value: 80, source: "osm_graph" },
        shuttle_min_assumed: { value: 15, assumed: true, source: "assumed" },
      },
      total_min: { value: 37, sources: ["osm_graph", "caltrain_gtfs"] },
    },
  };
}

function usHome(id, region, rent, total) {
  return {
    id, name: `Home ${id}`, kind: "아파트", region,
    lon: -122.15, lat: 37.47, build_year: null, scene: null,
    station: { station: "Town", walk_minutes: 6 },
    buckets: [{ center_m2: null, range_m2: null, trade: null, jeonse: null,
      wolse: { count: 1, deposit: null,
        monthly: { count: 1, median_won: rent, min_won: rent, max_won: rent } } }],
    currency: "USD", country: "US",
    price: { source: "zillow_zori_zip", zip: "94301", zip_source: "osm_nearest",
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

describe("29N3i bogus box work target never leaks into alt", () => {
  it("usCommuteBest headlines Caltrain 37 with bike 24.8, never walk 11.2", () => {
    assert.deepEqual(
      usCommuteBest(bogusWorkHome("pa"), { total_min: 37 },
        { mode: "walk", minutes: 11.2 }),
      { mode: "caltrain", min: 37, alt: { mode: "bike", min: 24.8 } });
  });

  it("Korean card side note reads 자전거 직행 약 25분", () => {
    const r = find_homes(PROFILE, { homes: [bogusWorkHome("pa")] },
      { sort: "commute", limit: 6, regions: ["us-st-palo-alto"] });
    const row = commuteRowLine(r.candidates[0]);
    assert.ok(row.text.startsWith("칼트레인 37분"), `headline: ${row.text}`);
    assert.equal(row.alt, "또는 자전거 직행 약 25분(추정, 30일 살아 보기에는 없음)",
      `side note: ${row.alt}`);
  });
});

describe("29N3i sort note is one language per screen", () => {
  const homes = [usHome("h1", "us-st-palo-alto", 4000, 30),
    usHome("h2", "us-st-redwood-city", 4100, 31)];
  const regions = ["us-st-palo-alto", "us-st-redwood-city"];

  it("Korean note has no ASCII words", () => {
    const r = find_homes(PROFILE, { homes },
      { sort: "areas", limit: 6, regions });
    assert.equal(r.sort_note, "정렬: 동네마다 한 곳씩(가까운 동네부터)",
      `note: ${r.sort_note}`);
    assert.ok(!/[A-Za-z]/.test(r.sort_note), `note: ${r.sort_note}`);
  });

  it("English note has no Hangul", () => withLang("en", () => {
    const r = find_homes(PROFILE, { homes },
      { sort: "areas", limit: 6, regions });
    assert.equal(r.sort_note, "one home per area (closest area first)",
      `note: ${r.sort_note}`);
    assert.ok(!/[가-힣]/.test(r.sort_note), `note: ${r.sort_note}`);
  }));
});

describe("29N3i USD reads $3,541 in Korean lines", () => {
  it("monthly USD rent leads with $", () => {
    const line = fmtMoney(3541, "USD", { monthly: true });
    assert.ok(line.includes("$3,541"), `line: ${line}`);
    assert.ok(!line.includes("3,541$"), `line: ${line}`);
  });

  it("the report prompt pins the $3,541 form", () => {
    assert.ok(REPORT_PROMPT.includes("$3,541"), REPORT_PROMPT);
  });
});

describe("29N3i US stations read Korean on the Korean screen", () => {
  it("map plate: 팔로알토역 / Palo Alto Stn", () => {
    assert.equal(stationLabelName("Palo Alto", "ko"), "팔로알토역");
    assert.equal(stationLabelName("Palo Alto", "en"), "Palo Alto Stn");
  });

  it("3D pill: 팔로알토역 · 칼트레인 / Palo Alto Stn · Caltrain", () => {
    assert.equal(stationRideLabel("Palo Alto", "ko", { caltrain: true }),
      "팔로알토역 · 칼트레인");
    assert.equal(stationRideLabel("Palo Alto", "en", { caltrain: true }),
      "Palo Alto Stn · Caltrain");
  });
});
