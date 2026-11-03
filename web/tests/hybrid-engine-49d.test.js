// Stage 49d: hybrid engine — per-weekday home_office_days.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine/simulate.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

const STATION_WORK = {
  type: "station_ride", station_name: "중앙역", ride_minutes: 20,
  ride_minutes_source: "user_assumption",
};

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

function commuteDays(run, agent) {
  const days = run.trips
    .filter((t) => t.agent === agent && t.purpose === "commute")
    .map((t) => t.day);
  return [...new Set(days)].sort((a, b) => a - b);
}

describe("hybrid engine 49d", () => {
  it("Tue remote: work trips Mon and Wed only", () => {
    const sc = scFor(3, [member({ workdays: ["Mon", "Tue", "Wed"], home_office_days: ["Tue"] })]);
    const run = simulate(tinyArea(), sc, "A");
    assert.deepEqual(commuteDays(run, "h1"), [0, 2]);
  });

  it("second normal member still commutes all 3 days", () => {
    const sc = scFor(3, [
      member({ id: "m1", label: "구성원 1", workdays: ["Mon", "Tue", "Wed"], home_office_days: ["Tue"] }),
      member({ id: "m2", label: "구성원 2", workdays: ["Mon", "Tue", "Wed"] }),
    ]);
    const run = simulate(tinyArea(), sc, "A");
    assert.deepEqual(commuteDays(run, "h1"), [0, 2]);
    assert.deepEqual(commuteDays(run, "h2"), [0, 1, 2]);
  });

  it("30 days Tue+Thu remote: 13 commute days vs normal 22", () => {
    const hybrid = scFor(30, [member({ home_office_days: ["Tue", "Thu"] })]);
    const normal = scFor(30, [member({})]);
    const hybridRun = simulate(tinyArea(), hybrid, "A");
    const normalRun = simulate(tinyArea(), normal, "A");
    assert.equal(commuteDays(hybridRun, "h1").length, 13);
    assert.equal(normalRun && commuteDays(normalRun, "h1").length, 22);
    for (const d of commuteDays(hybridRun, "h1")) {
      assert.ok(![1, 3, 8, 10, 15, 17, 22, 24, 29].includes(d), `commute on remote day ${d}`);
    }
  });

  it("legacy home_office true means no commute", () => {
    const sc = scFor(7, [member({ home_office: true })]);
    const run = simulate(tinyArea(), sc, "A");
    assert.equal(run.trips.filter((t) => t.agent === "h1" && t.purpose === "commute").length, 0);
  });

  it("explicit empty array overrides legacy true", () => {
    const sc = scFor(30, [member({ home_office: true, home_office_days: [] })]);
    const run = simulate(tinyArea(), sc, "A");
    assert.equal(commuteDays(run, "h1").length, 22);
  });

  it("validation rejects bad home_office_days", () => {
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ home_office_days: ["Tue", "Tue"] })]), "A"),
    /home_office_days/);
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ home_office_days: ["Funday"] })]), "A"),
    /home_office_days/);
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ home_office_days: "Tue" })]), "A"),
    /home_office_days/);
    assert.throws(() => simulate(tinyArea(),
      scFor(7, [member({ workdays: ["Mon", "Tue"], home_office_days: ["Wed"] })]), "A"),
    /home_office_days/);
  });
});
