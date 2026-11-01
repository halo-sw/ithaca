// Stage 29N3b — station-box homes lead with the measured Caltrain
// route (what the 30-day run lives); the direct bike estimate is a
// side note. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { find_homes, usCommuteBest } from "../src/homes.js";
import { commuteMinutesOf } from "../src/chatmap.js";

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

// Palo Alto station-box home: labelled Caltrain total 40.4, direct
// bike 25.9, and a stale explicit best pointing at the bike estimate.
function paloAltoHome(id) {
  return {
    id, name: `Home ${id}`, kind: "아파트", region: "us-st-palo-alto",
    lon: -122.15, lat: 37.47, build_year: null, scene: null,
    station: { station: "Town", walk_minutes: 8 },
    work_targets: { "meta-hq": { walk_minutes: 70, bike_minutes: 25.9 } },
    buckets: [{ center_m2: null, range_m2: null, trade: null, jeonse: null,
      wolse: { count: 1, deposit: null,
        monthly: { count: 1, median_won: 3950, min_won: 3950, max_won: 3950 } } }],
    currency: "USD", country: "US",
    price: { source: "zillow_zori_zip", zip: "94301", zip_source: "osm_nearest",
      month: "2026-09", label: "Zillow ZORI" },
    commute: {
      destination: "Menlo Park",
      best: { mode: "bike", min: 25.9 },
      walk_to_station_min: { value: 8, source: "osm_graph" },
      caltrain_min: { value: 3, source: "caltrain_gtfs" },
      headway_min: { value: 16, source: "caltrain_gtfs" },
      last_mile: {
        bike_min: { value: 22, source: "osm_graph" },
        walk_min: { value: 90, source: "osm_graph" },
        shuttle_min_assumed: { value: 15, assumed: true, source: "assumed" },
      },
      total_min: { value: 40.4, sources: ["osm_graph", "caltrain_gtfs"] },
    },
  };
}

function menloHome(id) {
  const h = paloAltoHome(id);
  h.region = "us-menlo";
  delete h.commute;
  return h;
}

describe("29N3b measured Caltrain first", () => {
  it("usCommuteBest ignores the stale bike best on a station-box home", () => {
    assert.deepEqual(
      usCommuteBest(
        { region: "us-st-palo-alto", commute: { best: { mode: "bike", min: 25.9 } } },
        { total_min: 40.4 }, { mode: "bike", minutes: 25.9 }),
      { mode: "caltrain", min: 40.4, alt: { mode: "bike", min: 25.9 } });
    assert.deepEqual(
      usCommuteBest({ region: "us-st-redwood-city" }, { total_min: 30 }, null),
      { mode: "caltrain", min: 30 });
  });

  it("us-menlo keeps its walk/bike headline", () => {
    assert.deepEqual(
      usCommuteBest({ region: "us-menlo", commute: { best: { mode: "bike", min: 12 } } },
        { total_min: 40 }, { mode: "bike", minutes: 12 }),
      { mode: "bike", min: 12 });
    assert.deepEqual(usCommuteBest({ region: "us-menlo" }, null,
      { mode: "walk", minutes: 12 }), { mode: "walk", min: 12 });
  });

  it("the row headlines Caltrain 40 and carries the bike estimate aside", () => {
    const r = find_homes(PROFILE, { homes: [paloAltoHome("pa")] },
      { sort: "commute", limit: 6, regions: ["us-st-palo-alto"] });
    const pa = r.candidates[0];
    assert.equal(pa.best_mode, "caltrain");
    assert.equal(pa.best_min, 40);
    assert.equal(pa.bike_direct_estimate_min, 25.9);
    assert.equal(commuteMinutesOf(pa), 40, "pins read the headline minutes");
  });

  it("English card headlines the breakdown with the estimate side note", () =>
    withLang("en", () => {
      const r = find_homes(PROFILE, { homes: [paloAltoHome("pa")] },
        { sort: "commute", limit: 6, regions: ["us-st-palo-alto"] });
      const row = commuteRowLine(r.candidates[0]);
      assert.ok(row.text.startsWith("Caltrain 40 min"), `headline: ${row.text}`);
      assert.ok(row.alt.includes("(estimate, not in the 30-day run)"),
        `side note: ${row.alt}`);
      assert.ok(row.alt.includes("26 min"), `side note: ${row.alt}`);
    }));

  it("Korean card headlines 칼트레인 40분 with the estimate side note", () =>
    withLang("ko", () => {
      const r = find_homes(PROFILE, { homes: [paloAltoHome("pa")] },
        { sort: "commute", limit: 6, regions: ["us-st-palo-alto"] });
      const row = commuteRowLine(r.candidates[0]);
      assert.ok(row.text.startsWith("칼트레인 40분"), `headline: ${row.text}`);
      assert.ok(row.alt.includes("30일 살아 보기에는 없음"), `side note: ${row.alt}`);
    }));

  it("a us-menlo home keeps its walk/bike card headline", () =>
    withLang("en", () => {
      const r = find_homes(PROFILE, { homes: [menloHome("m1")] },
        { sort: "commute", limit: 6, regions: ["us-menlo"] });
      const row = commuteRowLine(r.candidates[0]);
      assert.ok(!row.text.startsWith("Caltrain"), `headline: ${row.text}`);
      assert.equal(row.alt, undefined);
    }));
});
