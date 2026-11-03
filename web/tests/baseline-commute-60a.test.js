import test from "node:test";
import assert from "node:assert/strict";
import { haversineM, listingWalkMin, summarizeDiffs, buildRow, stationPointFromArea, commuteParts } from "../scripts/baseline-commute.mjs";
import { oneWayCommuteOfRun } from "../src/verify/numbers.js";

const R = 6371008.8;
const dLat400 = (400 / R) * (180 / Math.PI);

function home(i, station, walk) {
  return { id: `h${i}`, name: `home${i}`, station: { station, walk_minutes: walk }, lon: 127.0, lat: 37.0 };
}

test("listing walk minutes", () => {
  assert.equal(listingWalkMin(800, 80), 10);
  assert.equal(listingWalkMin(670, 67), 10);
});

test("haversine reference", () => {
  const d = haversineM(127.0, 37.0, 127.0, 37.01);
  assert.ok(Math.abs(d - 1112) <= 2, `got ${d}`);
});

test("buildRow listing vs engine", () => {
  const row = buildRow({ set: "K1", cand: { id: "h1", name: "home1" }, home: home(1, "정자", 6.2),
    stationLonLat: [127.0, 37.0 + dLat400], rideMin: 12, engineValues: [20, 22, null] });
  assert.equal(row.station_walk_listing_min, 5);
  assert.equal(row.commute_listing_min, 17);
  assert.equal(row.commute_engine_min, 21);
  assert.equal(row.diff_min, 4);
});

test("buildRow without rail leg", () => {
  const row = buildRow({ set: "U", cand: { id: "h2", name: "home2" }, home: home(2, "Palo Alto", 3),
    stationLonLat: [127.0, 37.0 + dLat400], rideMin: null, engineValues: [] });
  assert.equal(row.diff_min, null);
  assert.equal(row.reason, "no rail leg in the engine trip");
});

test("summarizeDiffs counts and determinism", () => {
  const good = (diff, listing, engine) => ({ diff_min: diff, commute_listing_min: listing, commute_engine_min: engine });
  const rows = [good(4, 17, 21), good(-2, 20, 18), good(null, null, null)];
  const s = summarizeDiffs(rows);
  assert.equal(s.n, 2);
  assert.equal(s.excluded, 1);
  assert.equal(JSON.stringify(summarizeDiffs(rows)), JSON.stringify(summarizeDiffs(rows)));
});

test("stationPointFromArea picks the nearer station and ignores non-stations", () => {
  const home = [-122.159, 37.444];
  const near = [-122.16, 37.443];
  const far = [-122.17, 37.45];
  const area = { pois: [
    { category: "railway:station", name: "Palo Alto Caltrain", geometry: { type: "Point", coordinates: far } },
    { category: "railway:station", name: "Palo Alto", geometry: { type: "Point", coordinates: near } },
    { category: "amenity:cafe", name: "Palo Alto", geometry: { type: "Point", coordinates: home } },
  ] };
  assert.deepEqual(stationPointFromArea(area, "Palo Alto", home), near);
});

test("stationPointFromArea returns null with no matching POI", () => {
  const home = [-122.159, 37.444];
  const area = { pois: [
    { category: "railway:station", name: "Palo Alto", geometry: { type: "Point", coordinates: [-122.16, 37.443] } },
  ] };
  assert.equal(stationPointFromArea(area, "Redwood City", home), null);
});

function partsFixtureRun() {
  const trips = [];
  for (const member of ["m1", "m2"]) {
    for (const day of [0, 1]) {
      trips.push({ purpose: "commute", agent: member, day, depart_min: 480 });
      trips.push({ purpose: "commute", agent: member, day, depart_min: 1080 });
    }
  }
  return {
    agents: [{ key: "m1", household: true }, { key: "m2", household: true }],
    trips,
    aways: [],
    totals: { per_member: {
      m1: { commute_walk_minutes: 20, commute_ride_minutes: 40, commute_wait_minutes: 8 },
      m2: { commute_walk_minutes: 12, commute_ride_minutes: 40, commute_wait_minutes: 4 },
    } },
  };
}

test("commuteParts splits walk, ride and wait per one-way half", () => {
  const run = partsFixtureRun();
  assert.deepEqual(commuteParts(run), { walk: 4, ride: 10, wait: 1.5 });
  const parts = commuteParts(run);
  assert.equal(parts.walk + parts.ride + parts.wait, oneWayCommuteOfRun(run));
});

test("buildRow averages seed parts and summarizeDiffs returns parts_mean", () => {
  const row = buildRow({ set: "K1", cand: { id: "h1", name: "home1" }, home: home(1, "정자", 6.2),
    stationLonLat: [127.0, 37.0 + dLat400], rideMin: 12, engineValues: [20, 22],
    engineParts: [{ walk: 4, ride: 10, wait: 2 }, { walk: 6, ride: 12, wait: 4 }] });
  assert.equal(row.engine_walk_min, 5);
  assert.equal(row.engine_ride_min, 11);
  assert.equal(row.engine_wait_min, 3);
  const s = summarizeDiffs([
    { ...row },
    { ...row, engine_walk_min: 7, engine_ride_min: 13, engine_wait_min: 5 },
  ]);
  assert.deepEqual(s.parts_mean, { walk: 6, ride: 12, wait: 4 });
});
