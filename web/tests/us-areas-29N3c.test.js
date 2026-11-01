// Stage 29N3c — sort "areas" on a multi-area US set picks one home
// per area in headline-commute order (US rows carry no station origin,
// so pickByNeighbourhood cannot group them). node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { find_homes, pickByNeighbourhood } from "../src/homes.js";

const PROFILE = { tenure: { value: "wolse" },
  monthlyMax: { value: 6000 }, currency: { value: "USD" } };

const AREAS6 = ["us-menlo", "us-st-palo-alto", "us-st-redwood-city",
  "us-st-belmont", "us-st-san-carlos", "us-st-sunnyvale"];

function usHome(id, region, rent, zip, total) {
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

// Totals interleaved round-robin so a pure-commute page would cluster
// in the first areas.
function twelveOverSix() {
  const homes = [];
  const totals = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  totals.forEach((total, i) => {
    homes.push(usHome(`h${i + 1}`, AREAS6[i % 6],
      3800 + i * 50, `94${300 + (i % 6)}`, total));
  });
  return homes;
}

function twelveOverThree() {
  const homes = [];
  const totals = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  totals.forEach((total, i) => {
    homes.push(usHome(`h${i + 1}`, AREAS6[i % 3],
      3800 + i * 50, `94${300 + (i % 3)}`, total));
  });
  return homes;
}

describe("29N3c US areas sort spreads one home per area", () => {
  it("6 areas x 2 rows, limit 6 -> six distinct regions in best_min order", () => {
    const r = find_homes(PROFILE, { homes: twelveOverSix() },
      { sort: "areas", limit: 6, regions: [...AREAS6] });
    assert.equal(r.candidates.length, 6);
    const regions = r.candidates.map((c) => c.region);
    assert.equal(new Set(regions).size, 6, `distinct: ${regions}`);
    const mins = r.candidates.map((c) => c.best_min);
    assert.ok(mins.every(Number.isFinite), `headlines: ${mins}`);
    assert.deepEqual([...mins].sort((a, b) => a - b), mins);
    // 29N3i: one language per screen (Korean here — no window).
    assert.equal(r.sort_note, "정렬: 동네마다 한 곳씩(가까운 동네부터)",
      `note: ${r.sort_note}`);
    assert.ok(!/[A-Za-z]/.test(r.sort_note), `note: ${r.sort_note}`);
  });

  it("English screen reads the English note only, no Hangul", () => {
    const prev = globalThis.window;
    globalThis.window = { location: { search: "?lang=en", href: "" } };
    try {
      const r = find_homes(PROFILE, { homes: twelveOverSix() },
        { sort: "areas", limit: 6, regions: [...AREAS6] });
      assert.equal(r.sort_note, "one home per area (closest area first)",
        `note: ${r.sort_note}`);
      assert.ok(!/[가-힣]/.test(r.sort_note), `note: ${r.sort_note}`);
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });

  it("3 areas x 4 rows, limit 6 -> 3 distinct first, then commute order", () => {
    const r = find_homes(PROFILE, { homes: twelveOverThree() },
      { sort: "areas", limit: 6, regions: AREAS6.slice(0, 3) });
    assert.equal(r.candidates.length, 6);
    const regions = r.candidates.map((c) => c.region);
    assert.equal(new Set(regions.slice(0, 3)).size, 3, `first: ${regions}`);
    const mins = r.candidates.map((c) => c.best_min);
    assert.deepEqual([...mins].sort((a, b) => a - b), mins);
    assert.deepEqual(r.candidates.map((c) => c.id),
      ["h1", "h2", "h3", "h4", "h5", "h6"]);
  });
});

// Korean neighbourhood spread is untouched: one home per origin
// station, nearest origin first (fixture shape from by-neighbourhood-36a).
function kRow(id, station, walkMin, rideMin) {
  return {
    id,
    thin_deal: null,
    deals_in_bucket: 5,
    commute: {
      walk: { known: true, station, minutes: walkMin },
      ride: { known: true, minutes: rideMin, lines: ["수인·분당선"], transfers: [] },
      destStation: "판교",
    },
  };
}

const K_SPREAD = [
  kRow("h5", "오리", 5, 0),
  kRow("h12", "미금", 7, 5),
  kRow("h12b", "미금", 9, 5),
  kRow("h20", "정자", 8, 12),
  kRow("h28", "수내", 10, 18),
  kRow("h41", "잠실", 7, 34),
  kRow("h55", "강남", 10, 45),
];

describe("29N3c Korean areas spread unchanged", () => {
  it("still picks one home per origin station, near to far", () => {
    const out = pickByNeighbourhood(K_SPREAD, 6, null);
    assert.equal(out.length, 6);
    const stations = out.map((r) => r.origin.station);
    assert.equal(new Set(stations).size, 6);
    assert.ok(!out.some((r) => r.id === "h12b"), "second 미금 home dropped");
    assert.deepEqual(out.map((r) => r.commute_total_min),
      [5, 12, 20, 28, 41, 55]);
  });
});
