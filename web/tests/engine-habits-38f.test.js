// Stage 38f: household habits — café on remote days, a morning dog
// walk, a vet visit. Reuses the shared tiny fixture (no new data files);
// café/vet POIs are pushed onto the fixture area in-test.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine/simulate.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

const STATION_WORK = {
  type: "station_ride", station_name: "중앙역", ride_minutes: 20,
  ride_minutes_source: "user_assumption",
};

// Fixture area plus one reachable café and one reachable vet (same
// coords as existing anchored POIs, so both stay within MAX_ANCHOR_M).
function habitArea() {
  const area = tinyArea();
  const at = (lon, lat) => ({ type: "Point", coordinates: [lon, lat] });
  area.pois.push(
    { id: "cafe1", name: "카페", category: "amenity:cafe", osm_kind: "node",
      osm_id: 2, geometry: at(127.001, 37.5001) },
    { id: "vet1", name: "동물병원", category: "amenity:veterinary",
      osm_kind: "node", osm_id: 3, geometry: at(127.0011, 37.5001) },
  );
  return area;
}

function member(over = {}) {
  return {
    id: "m1", label: "구성원 1", role: "adult",
    workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    work: { ...STATION_WORK },
    errands_per_week: { supermarket: 0, convenience: 0 },
    park_walks_per_week: 0, clinic_visits_per_month: 0,
    ...over,
  };
}

function scFor(days, members, seed = 42) {
  const sc = tinyScenario({ days, seed, background: 0 });
  sc.household.members = members;
  return sc;
}

describe("engine habits 38f", () => {
  it("defaults keep the run byte-identical", () => {
    const plain = simulate(tinyArea(), tinyScenario(), "A");
    const sc = tinyScenario();
    sc.household.members = sc.household.members.map((m) => ({
      ...m, cafe_visits_per_week: 0, vet_visits_per_month: 0,
      home_office: false, dog_walk_morning: false,
    }));
    const explicit = simulate(tinyArea(), sc, "A");
    assert.equal(JSON.stringify(explicit.trips), JSON.stringify(plain.trips));
  });

  it("cafe: exactly 2 aways on Mon and Wed, never on workdays", () => {
    const sc = scFor(7, [member({ workdays: ["Tue", "Thu"], cafe_visits_per_week: 2 })]);
    const run = simulate(habitArea(), sc, "A");
    const cafes = run.aways.filter((a) => a.agent === "h1" && a.kind === "cafe");
    assert.equal(cafes.length, 2);
    assert.deepEqual(cafes.map((a) => a.day).sort((x, y) => x - y), [0, 2]);
    for (const a of cafes) {
      assert.ok(a.label.endsWith(" 작업"), `cafe label: ${a.label}`);
      assert.ok(a.day !== 1 && a.day !== 3, `cafe on workday: ${a.day}`);
    }
    const legs = run.trips.filter((t) => t.agent === "h1" && t.purpose === "cafe");
    assert.equal(legs.length, 4); // out + back per visit
  });

  it("dog: 7 morning park aways, each ending before the commute", () => {
    const sc = scFor(7, [member({ dog_walk_morning: true })]);
    const run = simulate(habitArea(), sc, "A");
    const walks = run.aways.filter((a) => a.agent === "h1"
      && a.kind === "park" && a.label.endsWith(" 강아지 산책"));
    assert.equal(walks.length, 7);
    const legs = run.trips.filter((t) => t.agent === "h1"
      && t.purpose === "park" && t.cause.criterion_ids.includes("C-dog-walk"));
    assert.equal(legs.length, 14);
    for (let d = 0; d < 7; d++) {
      const walk = walks.find((a) => a.day === d);
      assert.ok(walk, `no morning walk on day ${d}`);
      const back = run.trips.filter((t) => t.agent === "h1" && t.day === d
        && t.purpose === "park" && t.depart_min === walk.end_min);
      assert.equal(back.length, 1);
      const commute = run.trips.filter((t) => t.agent === "h1"
        && t.day === d && t.purpose === "commute");
      if (commute.length === 0) continue; // weekend: no commute
      const firstDepart = Math.min(...commute.map((t) => t.depart_min));
      assert.ok(back[0].arrive_min <= firstDepart,
        `day ${d}: walk returns ${back[0].arrive_min}, commute departs ${firstDepart}`);
    }
  });

  it("vet: exactly 1 visit over 30 days", () => {
    const sc = scFor(30, [member({ vet_visits_per_month: 1 })]);
    const run = simulate(habitArea(), sc, "A");
    const vets = run.aways.filter((a) => a.agent === "h1" && a.kind === "vet");
    assert.equal(vets.length, 1);
    assert.ok(vets[0].label.endsWith(" 진료"), `vet label: ${vets[0].label}`);
  });

  it("vet: unavailable when no vet is reachable", () => {
    const sc = scFor(30, [member({ vet_visits_per_month: 1 })]);
    const run = simulate(tinyArea(), sc, "A");
    assert.equal(run.aways.filter((a) => a.agent === "h1" && a.kind === "vet").length, 0);
    const un = run.unavailable.filter((u) => u.agent === "h1" && u.activity === "vet");
    assert.equal(un.length, 1);
    assert.equal(un[0].category, "vet");
  });

  it("home office: no commute trips, 5 cafe aways per Mon-Fri week", () => {
    const sc = scFor(7, [member({ home_office: true, cafe_visits_per_week: 5 })]);
    const run = simulate(habitArea(), sc, "A");
    assert.equal(run.trips.filter((t) => t.agent === "h1" && t.purpose === "commute").length, 0);
    const cafes = run.aways.filter((a) => a.agent === "h1" && a.kind === "cafe");
    assert.equal(cafes.length, 5);
    assert.deepEqual(cafes.map((a) => a.day).sort((x, y) => x - y), [0, 1, 2, 3, 4]);
  });

  it("validation rejects out-of-range habit fields", () => {
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ cafe_visits_per_week: 6 })]), "A"),
    /cafe_visits_per_week wants 0\.\.5/);
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ vet_visits_per_month: -1 })]), "A"),
    /vet_visits_per_month wants 0\.\.4/);
  });
});
