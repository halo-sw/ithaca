// Stage 29N3: "Live 30 days" for US Caltrain homes — walk to the
// station, wait half the headway, ride to Menlo Park, bike (or the
// assumed shuttle) to Meta HQ. Reuses commutePlace; Korean runs
// without last_mile stay byte-identical.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarioFromProfile, field } from "../src/profile.js";
import { parseScenario } from "../src/engine/scenario.js";
import { simulate } from "../src/engine/simulate.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const META_HQ = { name: "Meta HQ (1 Hacker Way)", lon: -122.14823, lat: 37.48485 };

function usProfile() {
  const f = (value) => field(value, "customer", "test");
  return {
    members: f([{ role: "adult" }]),
    workplaces: f([{ member: 0, text: "Meta HQ", resolved: { place: { ...META_HQ } } }]),
    salaryAnnual: f([90000]), takehomeMonthly: f(null), cash: f(10000),
    debts: f(0), tenure: f("wolse"), depositMax: f(null), monthlyMax: f(4500),
    priceMax: f(null), sizeMin: f(null), commuteMax: f(null),
    priorities: f({ edu: 3, life: 3, safety: 3, money: 3, convenience: 3 }),
    mustHaves: f([]), home_kinds: f([]), currency: f("USD"),
  };
}

async function loadBuiltHome(file, index = 0) {
  const doc = JSON.parse(await readFile(join(ROOT, "data", "build", "homes", file), "utf8"));
  return doc.homes[index];
}

async function loadArea(areaId) {
  const dir = join(ROOT, "data", "build", areaId);
  const area = JSON.parse(await readFile(join(dir, "area.json"), "utf-8"));
  for (const [key, value] of Object.entries(area)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.$ref) {
      area[key] = JSON.parse(await readFile(join(dir, value.$ref), "utf-8"));
    }
  }
  return area;
}

describe("29N3 scenarioFromProfile for Caltrain homes", () => {
  it("a Palo Alto home rides station_ride; a Belle Haven home keeps place", async () => {
    const palo = await loadBuiltHome("us-st-palo-alto.json");
    const menlo = await loadBuiltHome("us-menlo.json");
    const scPalo = scenarioFromProfile(usProfile(), [palo]);
    const work = scPalo.household.members[0].work;
    assert.equal(work.type, "station_ride");
    assert.deepEqual(work.station_name, { A: "Palo Alto" });
    assert.equal(work.destination_station, "Menlo Park");
    assert.deepEqual(work.ride_minutes, { A: 3 });
    assert.equal(work.ride_minutes_source, "caltrain_gtfs");
    assert.deepEqual(work.wait_minutes, { A: 7.5 });
    assert.equal(work.wait_minutes_source, "caltrain_gtfs_half_headway");
    assert.deepEqual(work.last_mile, { mode: "bike", shuttle_min_assumed: 15 });
    assert.deepEqual(work.place, META_HQ);
    assert.equal(scPalo.dest_area, "us-menlo");
    parseScenario(scPalo); // still a valid scenario

    const scMenlo = scenarioFromProfile(usProfile(), [menlo]);
    assert.equal(scMenlo.household.members[0].work.type, "place");
    assert.equal(scMenlo.dest_area, undefined);
  });

  it("a mixed pair (Belle Haven + Palo Alto) rides per home", async () => {
    const menlo = await loadBuiltHome("us-menlo.json");
    const palo = await loadBuiltHome("us-st-palo-alto.json");
    const sc = scenarioFromProfile(usProfile(), [menlo, palo]);
    const work = sc.household.members[0].work;
    assert.equal(work.type, "station_ride");
    assert.deepEqual(work.station_name, { B: "Palo Alto" });
    assert.deepEqual(work.ride_minutes, { B: 3 });
    assert.deepEqual(work.wait_minutes, { B: 7.5 });
    parseScenario(sc);
  });
});

describe("29N3 live run on the real boxes", { skip: !existsSync(join(ROOT, "data", "build", "us-st-palo-alto", "area.json"))
  || !existsSync(join(ROOT, "data", "build", "us-menlo", "area.json"))
  ? "missing data/build/us-st-palo-alto or us-menlo area.json — build the boxes first" : false }, () => {
  it("day 0 walks, waits, rides Caltrain, bikes to Meta HQ near the labelled total", async () => {
    const area = await loadArea("us-st-palo-alto");
    const destArea = await loadArea("us-menlo");
    const network = JSON.parse(
      await readFile(join(ROOT, "data", "build", "region-us", "network.json"), "utf8"));
    const palo = await loadBuiltHome("us-st-palo-alto.json");
    const total = palo.commute.total_min.value;
    const raw = scenarioFromProfile(usProfile(), [palo]);
    const run = simulate(area, { ...raw, days: 3, background: 0 }, "A",
      { region: { network, congestion: null }, destArea });

    const trips = run.trips.filter((t) => t.agent === "h1" && t.day === 0);
    const aways = run.aways.filter((a) => a.agent === "h1" && a.day === 0);
    const walkTrip = trips.find((t) => t.purpose === "commute" && !t.mode);
    assert.ok(walkTrip, "a walk trip leaves home");
    assert.equal(walkTrip.to.label, "Palo Alto");
    const wait = aways.find((a) => a.kind === "wait");
    assert.ok(wait, "a wait away is recorded");
    assert.equal(wait.label, "열차 대기");
    assert.equal(wait.end_min - wait.start_min, 7.5);
    assert.equal(wait.start_min, walkTrip.arrive_min);
    assert.equal(wait.detail.wait_minutes_source, "caltrain_gtfs_half_headway");
    const ride = aways.find((a) => a.kind === "ride" && a.detail.direction === "out");
    assert.ok(ride, "a ride away is recorded");
    assert.equal(ride.label, "Caltrain");
    assert.equal(ride.start_min, wait.end_min);
    assert.ok(ride.detail.ride && ride.detail.ride.legs.length > 0);
    assert.ok(ride.detail.ride.legs.every((l) => l.line === "caltrain"));
    assert.match(ride.detail.ride.legs[0].from, /Palo Alto/);
    assert.match(ride.detail.ride.legs[ride.detail.ride.legs.length - 1].to, /Menlo Park/);
    assert.equal(ride.detail.dest_walk.mode, "bike");
    assert.equal(ride.detail.dest_walk.source, "graph");
    const bikeTrip = trips.find((t) => t.purpose === "commute" && t.mode === "bike");
    assert.ok(bikeTrip, "a bike trip covers the last mile");
    assert.equal(bikeTrip.to.label, "Meta HQ (1 Hacker Way)");
    assert.equal(bikeTrip.depart_min, ride.end_min);
    const work = aways.find((a) => a.kind === "work");
    assert.ok(work);
    assert.equal(work.start_min, bikeTrip.arrive_min);
    const doorToDoor = work.start_min - walkTrip.depart_min;
    assert.ok(Math.abs(doorToDoor - total) <= 3,
      `door-to-door ${doorToDoor} min within ±3 of labelled ${total}`);
    assert.ok(!run.unavailable.some((u) => u.agent === "h1" && u.day === 0 && u.activity === "commute"),
      "no unavailable commute record");
  });
});

describe("29N3 Korean runs are unchanged", () => {
  it("commutePlace without wait/last_mile matches the old shape", () => {
    const raw = tinyScenario({ days: 3, background: 0, seed: 7,
      household: { members: [
        { id: "m1", label: "구성원 1", role: "adult", workdays: ["Mon"],
          work: { type: "station_ride", station_name: "중앙역", ride_minutes: 20,
            ride_minutes_source: "user_assumption", destination_station: "직장역",
            place: { name: "먼직장", lon: 127.1, lat: 37.6 } } },
      ] } });
    const run = simulate(tinyArea(), raw, "A");
    assert.ok(!run.aways.some((a) => a.kind === "wait"), "no wait away");
    const out = run.aways.find((a) => a.agent === "h1" && a.day === 0
      && a.kind === "ride" && a.detail.direction === "out");
    assert.equal(out.label, "지하철 이동");
    assert.deepEqual(out.detail.dest_walk,
      { minutes: 0, distance_m: 0, source: "none", note: "목적지 지역 미생성" });
    assert.ok(!("mode" in out.detail.dest_walk));
  });
});
