import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLifePlanInput, validateLifePlan, summarizePlanRun } from "../src/life/plan.js";
import { simulate } from "../src/engine/simulate.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

// 47f: summarizePlanRun must read the production record schema —
// run.meta.days declares the period, trip.agent holds the engine key
// ("h1") linked to the scenario member id ("m1") via run.agents,
// run.daily gives day coverage, and run.unavailable holds the only
// missing-day evidence.

function baseScenario() {
  return {
    start_date: "2026-11-02", days: 30, seed: 7,
    homes: [{ label: "Home A" }],
    household: { members: [
      { id: "m1", label: "A", role: "office worker",
        work: { type: "office", place: "Downtown" }, workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      { id: "m2", label: "B", role: "child", schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    ] },
  };
}

function planFor(ids) {
  const input = buildLifePlanInput({ scenario: baseScenario(), profile: {}, messages: [], lang: "en" });
  const raw = { members: input.members.map((m) => ({ id: m.id, changes: [] })), observations: [], questions: [], unmodeled: [] };
  const plan = validateLifePlan(raw, input);
  assert.deepEqual(plan.members.map((m) => m.id).sort(), ids);
  return plan;
}

// Production-shaped 30-day run: the last trip leg is on day 4, h2 stays
// home all month (daily summaries still cover every day), two school
// unavailable records exist for h2, and noise (background, unknown
// agent, out-of-period days) must be ignored.
function prodRun() {
  const trips = [];
  let seq = 1;
  const tid = () => `t${String(seq++).padStart(6, "0")}`;
  for (let day = 0; day <= 4; day++) {
    trips.push({ id: tid(), agent: "h1", day, depart_min: 480, arrive_min: 500,
      from: { kind: "home" }, to: { kind: "poi" }, purpose: "commute", distance_m: 100, minutes: 20 });
  }
  trips.push({ id: tid(), agent: "h1", day: 2, depart_min: 600, arrive_min: 620, // minutes missing
    from: { kind: "home" }, to: { kind: "poi" }, purpose: "commute", distance_m: 50 });
  for (let day = 0; day < 30; day++) { // background: excluded even though the key looks household-like
    trips.push({ id: tid(), agent: "h8", day, depart_min: 480, arrive_min: 500,
      from: { kind: "home" }, to: { kind: "poi" }, purpose: "commute", distance_m: 200, minutes: 99 });
  }
  trips.push({ id: "t-ghost", agent: "ghost", day: 1, purpose: "commute", distance_m: 10, minutes: 5 });
  trips.push({ id: "t-oob-high", agent: "h1", day: 30, purpose: "commute", distance_m: 10, minutes: 5 });
  trips.push({ id: "t-oob-low", agent: "h1", day: -1, purpose: "commute", distance_m: 10, minutes: 5 });
  const h1days = Array.from({ length: 30 }, (_, day) =>
    ({ day, commute_walk_minutes: 2, commute_ride_minutes: 20, commute_wait_minutes: 1, trips: day <= 4 ? 1 : 0 }));
  const h2days = Array.from({ length: 30 }, (_, day) =>
    (day === 5 ? { day, commute_walk_minutes: 0, commute_ride_minutes: 0, trips: 0 } // wait source unknown
      : { day, commute_walk_minutes: 0, commute_ride_minutes: 0, commute_wait_minutes: 0, trips: 0 }));
  return {
    meta: { days: 30 },
    agents: [
      { key: "h1", id: "m1", label: "A", household: true },
      { key: "h2", id: "m2", label: "B", household: true },
      { key: "h8", id: "b01", label: "주민 01", household: false },
    ],
    trips,
    unavailable: [
      { agent: "h2", day: 10, activity: "school", category: "school" },
      { agent: "h2", day: 11, activity: "school", category: "school" },
      { agent: "h8", day: 12, activity: "school", category: "school" }, // background: ignored
      { agent: "h1", day: 40, activity: "school", category: "school" }, // out of period: ignored
      { agent: "h2", day: "x", activity: "school", category: "school" }, // invalid day: ignored
    ],
    daily: [{ agent: "h1", days: h1days }, { agent: "h2", days: h2days }, { agent: "h8", days: h1days }],
  };
}

describe("summarizePlanRun on production records (47f)", () => {
  it("maps h1/h2 to m1/m2, excludes background, and counts from actual events", () => {
    const out = summarizePlanRun(prodRun(), planFor(["m1", "m2"]));
    // 5 commute legs with minutes + 1 leg without: background (30), ghost, and out-of-period legs excluded.
    assert.equal(out.full_period.trips, 6);
    assert.equal(out.full_period.travel_minutes, 5 * 20);
    assert.equal(out.full_period.travel_minutes_partial, true); // partial, never presented as complete
    assert.equal(out.missing.legs_missing_minutes, 1);
    assert.deepEqual(Object.keys(out.full_period.by_member), ["m1"]); // canonical ids, no h1/h8/ghost
    assert.deepEqual(out.missing.members_without_trips, ["m2"]);
    // All events fall in the first 7 days: equality with the full period is allowed, never extrapolated.
    assert.equal(out.first_7_days.trips, out.full_period.trips);
    assert.equal(out.first_7_days.travel_minutes, out.full_period.travel_minutes);
    assert.equal(out.first_7_days.by_member.m1.trips, 6);
    assert.deepEqual(out.evidence.trip_ids.length, 6);
    assert.equal(out.evidence.trip_ids_truncated, false);
  });

  it("covers 30 days from daily summaries even though the last trip is day 4, and counts only actual unavailable records", () => {
    const out = summarizePlanRun(prodRun(), planFor(["m1", "m2"]));
    assert.equal(out.day_coverage.total_days, 30); // meta.days declares the period, not last trip + 1
    assert.equal(out.day_coverage.observed_days, 30); // h2 all-home days still observed via daily
    assert.equal(out.day_coverage.active_trip_days, 5); // days 0..4 only
    assert.equal(out.day_coverage.coverage_source, "daily");
    // The two real school records count; quiet days with no record are not missing.
    assert.equal(out.missing.unavailable_records, 2);
    assert.equal(out.missing.unavailable_days, 2);
  });

  it("sums door-to-door commute minutes from daily fields and labels unknown sources", () => {
    const out = summarizePlanRun(prodRun(), planFor(["m1", "m2"]));
    // h1: 30 x (2 walk + 20 ride + 1 wait); h2: zeros. No walk_minutes double count.
    assert.equal(out.full_period.commute_minutes, 30 * 23);
    assert.equal(out.full_period.commute_minutes_partial, true); // h2 day 5 lacks commute_wait_minutes
    assert.equal(out.full_period.by_member.m1.commute_minutes, 30 * 23);
    assert.equal(out.full_period.by_member.m1.commute_minutes_partial, false);
    assert.equal(out.first_7_days.commute_minutes, 7 * 23);
  });

  it("falls back to trip-only coverage with no daily evidence", () => {
    const run = prodRun();
    delete run.daily;
    const out = summarizePlanRun(run, planFor(["m1", "m2"]));
    assert.equal(out.day_coverage.coverage_source, "trips_only");
    assert.equal(out.day_coverage.observed_days, 5); // only days with actual trip records
    assert.equal(out.full_period.commute_minutes, null);
    assert.equal(out.full_period.commute_minutes_partial, true);
  });

  it("summarises one small simulate() result with canonical member ids", () => {
    const run = simulate(tinyArea(), tinyScenario(), "A");
    const plan = { members: [{ id: "m1" }, { id: "m2" }] };
    const out = summarizePlanRun(run, plan);
    assert.equal(out.day_coverage.total_days, 7);
    assert.equal(out.day_coverage.observed_days, 7);
    assert.equal(out.day_coverage.coverage_source, "daily");
    const householdKeys = new Set(run.agents.filter((a) => a.household).map((a) => a.key));
    const wantTrips = run.trips.filter((t) => householdKeys.has(t.agent)).length;
    assert.equal(out.full_period.trips, wantTrips);
    assert.ok(wantTrips > 0);
    for (const id of Object.keys(out.full_period.by_member)) assert.ok(["m1", "m2"].includes(id));
    assert.ok(!("h1" in out.full_period.by_member) && !("h2" in out.full_period.by_member));
    assert.equal(typeof out.full_period.commute_minutes, "number");
    assert.equal(out.missing.unavailable_days, run.unavailable.filter((u) => householdKeys.has(u.agent)).length > 0
      ? new Set(run.unavailable.filter((u) => householdKeys.has(u.agent)).map((u) => u.day)).size : 0);
  });
});
