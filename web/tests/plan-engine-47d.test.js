// 47d3: engine-bridge tests — production profile -> scenario -> life
// plan -> confirmed -> apply -> parseScenario -> buildPrompt, plus real
// tiny-graph simulate cases for school modes. No invented stereotypes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProfile, field, scenarioFromProfile, runGate,
} from "../src/profile.js";
import {
  buildLifePlanInput, validateLifePlan, confirmLifePlan, applyLifePlan,
  lifePlanExplanation,
} from "../src/life/plan.js";
import { parseScenario } from "../src/engine/scenario.js";
import { simulate } from "../src/engine/simulate.js";
import { buildPrompt } from "../src/judge/context.js";
import { validateDecisionContext } from "../src/consult/server.js";
import { missingRouteHomes } from "../src/chat/engine.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

const home = (id, scene, station) => ({
  id, name: `집${id}`, pnu: `pnu${id}`, scene,
  station: station ? { station, walk_minutes: 8 } : null,
});
const HOMES_AB = [home("home-000001", "st-정자", "정자"), home("home-000002", "st-강남", "강남")];

const wp = (member, station, rideMinutes) => ({
  member, text: station, resolved: { station }, ride_minutes: rideMinutes,
});

function prof(members, workplaces, extra = {}) {
  const p = emptyProfile();
  p.members = field(members, "customer", "");
  if (workplaces) p.workplaces = field(workplaces, "customer", "");
  for (const [k, v] of Object.entries(extra)) p[k] = field(v, "customer", "");
  return p;
}

function inputOf(scenario, profile, messages = []) {
  return buildLifePlanInput({ scenario, profile, messages, lang: "ko" });
}

function rawFor(input, changesById = {}) {
  return {
    members: input.members.map((m) => ({ id: m.id, changes: changesById[m.id] || [] })),
    observations: [], questions: [], unmodeled: [],
  };
}

describe("47d3 two adults keep exact distinct preferences", () => {
  const members = [
    { role: "adult", preferences: "야근 잦음, 조용한 주거 선호", workdays: ["Mon", "Wed", "Fri"] },
    { role: "adult", preferences: "재택 병행, 자전거 출퇴근", workdays: ["Tue", "Thu"] },
  ];
  const p = prof(members, [wp(0, "판교", 25), wp(1, "강남", 30)]);
  const sc = scenarioFromProfile(p, HOMES_AB);
  it("copies each member's own workdays and preferences verbatim", () => {
    assert.deepEqual(sc.household.members[0].workdays, ["Mon", "Wed", "Fri"]);
    assert.deepEqual(sc.household.members[1].workdays, ["Tue", "Thu"]);
    assert.equal(sc.household.members[0].preferences, "야근 잦음, 조용한 주거 선호");
    assert.equal(sc.household.members[1].preferences, "재택 병행, 자전거 출퇴근");
  });
  it("marks both as stated and validates an exact-quote stated change", () => {
    const input = inputOf(sc, p, [{ role: "user", content: "야근 잦음, 조용한 주거 선호" }]);
    assert.ok(input.stated_fields.m1.includes("preferences"));
    assert.ok(input.stated_fields.m2.includes("preferences"));
    const raw = rawFor(input, {
      m1: [{ field: "preferences", value: "야근 잦음, 조용한 주거 선호", basis: "stated", evidence: "야근 잦음, 조용한 주거 선호" }],
    });
    const clean = validateLifePlan(raw, input);
    assert.equal(clean.members[0].changes[0].value, "야근 잦음, 조용한 주거 선호");
  });
});

describe("47d3 shared known work copies both-home ride map", () => {
  const p = prof([{ role: "adult" }, { role: "adult" }], [wp(0, "판교", 25)]);
  const sc = scenarioFromProfile(p, HOMES_AB);
  it("m2 starts unresolved; member:m1 clears and preserves the map", () => {
    assert.equal(sc.household.members[1].work_unresolved, true);
    const input = inputOf(sc, p);
    assert.throws(() => confirmLifePlan(validateLifePlan(rawFor(input), input), input), /unresolved work/);
    const shared = rawFor(input, { m2: [{ field: "commute", value: "member:m1", basis: "proposal", evidence: "" }] });
    const confirmed = confirmLifePlan(validateLifePlan(shared, input), input);
    const applied = applyLifePlan(sc, confirmed, input);
    assert.deepEqual(applied.household.members[1].work, applied.household.members[0].work);
    assert.deepEqual(applied.household.members[1].work.ride_minutes, { A: 25, B: 25 });
    assert.equal(applied.household.members[1].work_unresolved || false, false);
  });
  it("commute none also confirms the unresolved member", () => {
    const input = inputOf(sc, p);
    const none = rawFor(input, { m2: [{ field: "commute", value: "none", basis: "proposal", evidence: "출근 안 해요" }] });
    const confirmed = confirmLifePlan(validateLifePlan(none, input), input);
    const applied = applyLifePlan(sc, confirmed, input);
    assert.equal(applied.household.members[1].work.type, "none");
  });
});

describe("47d3 explicit none and home_office need no station", () => {
  const noStation = [home("home-000001", "st-정자", null), home("home-000002", "st-강남", null)];
  it("noCommute workplace runs without a station", () => {
    const p = prof([{ role: "adult" }], [{ member: 0, text: "출근 안 해요", noCommute: true, resolved: null }]);
    const sc = scenarioFromProfile(p, noStation);
    assert.equal(sc.household.members[0].work.type, "none");
    assert.equal(sc.household.members[0].work_unresolved || false, false);
    assert.deepEqual(runGate(p), { ok: true, noCommute: true });
  });
  it("member home_office runs without a station or workplace", () => {
    const p = prof([{ role: "adult", home_office: true }], []);
    const sc = scenarioFromProfile(p, noStation);
    assert.equal(sc.household.members[0].work.type, "none");
    assert.equal(sc.household.members[0].home_office, true);
  });
});

describe("47d3 seniors: work is never inferred", () => {
  it("a working senior keeps a real station_ride commute", () => {
    const p = prof([{ role: "adult" }, { role: "senior" }], [wp(0, "판교", 25), wp(1, "판교", 25)]);
    const sc = scenarioFromProfile(p, HOMES_AB);
    assert.equal(sc.household.members[1].work.type, "station_ride");
    assert.equal(sc.household.members[1].work_unresolved || false, false);
  });
  it("a senior without work stays unresolved, never retired", () => {
    const p = prof([{ role: "adult" }, { role: "senior" }], [wp(0, "판교", 25)]);
    const sc = scenarioFromProfile(p, HOMES_AB);
    assert.equal(sc.household.members[1].work.type, "none");
    assert.equal(sc.household.members[1].work_unresolved, true);
  });
  it("missingRouteHomes flags a working senior, ignores children and non-commuters", () => {
    const sc = { household: { members: [
      { id: "m1", role: "senior", work: { type: "station_ride", station_name: { A: "X" }, ride_minutes: { A: 10 } } },
      { id: "m2", role: "child", work: { type: "none" } },
      { id: "m3", role: "adult", work: { type: "none" } },
    ] } };
    assert.deepEqual(missingRouteHomes(sc, ["A", "B"]), [{ member: "m1", home: "B" }]);
    assert.deepEqual(missingRouteHomes(sc, ["A"]), []);
  });
});

describe("47d3 pets invent no routines", () => {
  it("a dog without visits adds no vet or walk facts", () => {
    const p = prof([{ role: "adult" }], [wp(0, "판교", 25)], { pets: { kind: "dog", count: 1 } });
    const sc = scenarioFromProfile(p, HOMES_AB);
    const m = sc.household.members[0];
    assert.equal(m.vet_visits_per_month, undefined);
    assert.equal(m.dog_walk_morning, undefined);
    assert.equal(m.cafe_visits_per_week, undefined);
    assert.deepEqual(m.errands_per_week, { supermarket: 1, convenience: 1 });
    assert.equal(m.park_walks_per_week, 1);
  });
});

describe("47d3 plan_context survives to the prompt; oversized rejected", () => {
  const p = prof([{ role: "adult" }, { role: "adult" }], [wp(0, "판교", 25), wp(1, "강남", 30)]);
  const sc = scenarioFromProfile(p, HOMES_AB);
  const input = inputOf(sc, p);
  const raw = {
    members: input.members.map((m) => ({ id: m.id, changes: [] })),
    observations: [
      { code: "commute", member_ids: ["m1"], reason: "판교 출근 확인" },
      { code: "school", member_ids: ["m2"], reason: "주말엔 쉬고 싶음" },
    ],
    questions: [], unmodeled: [],
  };
  const applied = applyLifePlan(sc, confirmLifePlan(validateLifePlan(raw, input), input), input);
  it("keeps per-member plan_context through parseScenario", () => {
    const parsed = parseScenario(applied);
    assert.ok(parsed.household.members[0].plan_context.includes("판교 출근 확인"));
    assert.ok(parsed.household.members[1].plan_context.includes("주말엔 쉬고 싶음"));
  });
  it("buildPrompt states context as confirmed intent, never outcome", () => {
    const parsed = parseScenario(applied);
    const prompt = buildPrompt({
      member: parsed.household.members[0], agentLabel: "나",
      date: "2026-11-02", weekday: "Mon", minute: 500,
      tripsToday: [], memory: [],
      shell: { kind: "shop_choice", options: [{ key: "home", label: "home" }] },
    });
    assert.ok(prompt.user.includes("Plan context (confirmed intent, not outcome)"));
    assert.ok(prompt.user.includes("판교 출근 확인"));
  });
  it("validateDecisionContext rejects oversized plan_context, keeps bounds", () => {
    const ctx = (plan_context) => ({ context: {
      member: { role: "adult", preferences: "조용", plan_context },
      shell: { kind: "shop_choice", options: [{ key: "home" }], default_key: "home", day: 0, minute: 500 },
      memory: [], tripsToday: [],
    } });
    assert.throws(() => validateDecisionContext(ctx("y".repeat(1201))), /plan_context/);
    assert.throws(() => validateDecisionContext({ context: {
      ...ctx("x").context, member: { role: "adult", preferences: "z".repeat(501) },
    } }), /preferences/);
    const ok = validateDecisionContext(ctx("y".repeat(1200)));
    assert.equal(ok.member.plan_context.length, 1200);
  });
});

describe("47d3 signature covers seed, criteria and sources", () => {
  const members = [{ role: "adult", preferences: "조용한 주거 선호" }];
  const p = prof(members, [wp(0, "판교", 25)]);
  const sc = scenarioFromProfile(p, HOMES_AB);
  it("changes with seed, criteria_overrides and profile source", () => {
    const base = inputOf(sc, p);
    assert.notEqual(inputOf({ ...sc, seed: 999 }, p).input_signature, base.input_signature);
    assert.notEqual(inputOf({ ...sc, criteria_overrides: { "C-walk-speed": {} } }, p).input_signature, base.input_signature);
    const def = emptyProfile();
    def.members = field(members, "default", "");
    def.workplaces = field([wp(0, "판교", 25)], "default", "");
    assert.notEqual(inputOf(sc, def).input_signature, base.input_signature);
  });
  it("explicit facts are never base defaults", () => {
    const def = emptyProfile();
    def.members = field([{ role: "adult" }], "default", "");
    def.workplaces = field([wp(0, "판교", 25)], "default", "");
    const input = inputOf(sc, def);
    assert.deepEqual(input.stated_fields, {});
    assert.deepEqual(input.members[0].assumptions.errands_per_week, { supermarket: 1, convenience: 1 });
  });
});

describe("47d3 full remote counts zero travel days", () => {
  it("home_office adult has 0 work days; adults have 0 school days", () => {
    const p = prof([{ role: "adult", home_office: true }], []);
    const sc = scenarioFromProfile(p, [home("home-000001", "st-정자", null)]);
    const input = inputOf(sc, p);
    const plan = confirmLifePlan(validateLifePlan(rawFor(input), input), input);
    const exp = lifePlanExplanation(plan, applyLifePlan(sc, plan, input), "en");
    assert.equal(exp.members[0].work_days, 0);
    assert.equal(exp.members[0].school_days, 0);
  });
});

describe("47d3 mixed household keeps every member's prefs", () => {
  it("adult, senior, child and pet prefs are each retained", () => {
    const p = prof([
      { role: "adult", preferences: "야간 교대" },
      { role: "senior", preferences: "병원 근처 희망" },
      { role: "child", preferences: "피아노 학원", school: true, school_level: "elementary" },
    ], [wp(0, "판교", 25), wp(1, "판교", 20)], { pets: { kind: "cat", count: 2 } });
    const sc = scenarioFromProfile(p, HOMES_AB);
    assert.equal(sc.household.members[0].preferences, "야간 교대");
    assert.equal(sc.household.members[1].preferences, "병원 근처 희망");
    assert.equal(sc.household.members[1].work.type, "station_ride");
    assert.equal(sc.household.members[2].preferences, "피아노 학원");
    assert.deepEqual(sc.household.members[2].school, { mode: "unresolved", level: "elementary" });
    const parsed = parseScenario(JSON.parse(JSON.stringify(sc)));
    assert.equal(parsed.household.members[0].preferences, "야간 교대");
    assert.equal(parsed.household.members[2].preferences, "피아노 학원");
  });
});

function childScenario(school) {
  return tinyScenario({
    days: 7,
    household: { members: [
      { id: "m1", label: "구성원 1", role: "adult", work: { type: "none" },
        errands_per_week: { supermarket: 0, convenience: 0 },
        park_walks_per_week: 0, clinic_visits_per_month: 0 },
      { id: "m2", label: "아이", role: "child", school,
        errands_per_week: { supermarket: 0, convenience: 0 },
        park_walks_per_week: 0, clinic_visits_per_month: 0 },
    ] },
  });
}
const schoolTrips = (run) => run.trips.filter((t) => t.agent === "h2" && t.purpose === "school");
const schoolUnav = (run) => run.unavailable.filter((u) => u.agent === "h2" && u.activity === "school");

describe("47d3 simulate school modes on the tiny graph", () => {
  it("unresolved school writes unavailable and runs no school trip", () => {
    const run = simulate(tinyArea(), childScenario({ mode: "unresolved", level: "unknown" }), "A");
    assert.equal(schoolUnav(run).length, 5);
    assert.equal(schoolTrips(run).length, 0);
  });
  it("nearby elementary skips a closer high school, labelled proxy not assignment", () => {
    const area = tinyArea();
    area.pois.push({ id: "sch2", name: "가까운고등학교", category: "amenity:school",
      osm_kind: "node", osm_id: 2, geometry: { type: "Point", coordinates: [127.001, 37.5] } });
    const run = simulate(area, childScenario({ mode: "nearby", level: "elementary" }), "A");
    const trips = schoolTrips(run);
    assert.ok(trips.length > 0);
    const aways = run.aways.filter((a) => a.agent === "h2" && a.kind === "school");
    assert.ok(aways.length > 0);
    for (const a of aways) {
      assert.ok(a.label.includes("초등학교"), `primary only, got ${a.label}`);
      assert.ok(!a.label.includes("고등"), `never the wrong school, got ${a.label}`);
      assert.ok(a.label.includes("가까운 학교 경로 가정, 배정 아님"));
    }
    assert.equal(schoolUnav(run).length, 0);
  });
  it("no matching type is unavailable, never the wrong school", () => {
    const area = tinyArea();
    area.pois = area.pois.filter((poi) => poi.id !== "sch1");
    area.pois.push({ id: "sch2", name: "가까운고등학교", category: "amenity:school",
      osm_kind: "node", osm_id: 2, geometry: { type: "Point", coordinates: [127.001, 37.5] } });
    const run = simulate(area, childScenario({ mode: "nearby", level: "elementary" }), "A");
    assert.ok(schoolUnav(run).length > 0);
    assert.equal(schoolTrips(run).length, 0);
  });
  it("legacy boolean keeps the nearest-proxy behavior", () => {
    const run = simulate(tinyArea(), childScenario(true), "A");
    assert.ok(schoolTrips(run).length > 0);
  });
  it("school false runs nothing", () => {
    const run = simulate(tinyArea(), childScenario(false), "A");
    assert.equal(schoolTrips(run).length, 0);
    assert.equal(schoolUnav(run).length, 0);
  });
});

function workUnresolvedScenario() {
  return tinyScenario({
    days: 7, background: 0,
    household: { members: [
      { id: "m1", label: "구성원 1", role: "adult", work: { type: "none" }, work_unresolved: true,
        workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        errands_per_week: { supermarket: 0, convenience: 0 },
        park_walks_per_week: 0, clinic_visits_per_month: 0 },
      { id: "m2", label: "아이", role: "child", school: { mode: "nearby", level: "elementary" },
        schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        errands_per_week: { supermarket: 0, convenience: 0 },
        park_walks_per_week: 0, clinic_visits_per_month: 0 },
    ] },
  });
}

describe("47m unknown commute is unavailable, never a fictional trip", () => {
  it("work_unresolved records commute/workplace on scheduled workdays only", () => {
    const run = simulate(tinyArea(), workUnresolvedScenario(), "A");
    const un = run.unavailable.filter((u) => u.agent === "h1" && u.activity === "commute");
    assert.equal(un.length, 5);
    assert.ok(un.every((u) => u.category === "workplace"
      && typeof u.detail === "string" && u.detail.length > 0));
    assert.equal(run.trips.filter((t) => t.agent === "h1" && t.purpose === "commute").length, 0);
    assert.ok(!run.unavailable.some((u) => u.agent === "h2" && u.activity === "commute"));
  });
  it("explicit commute none clears the record and runs no commute", () => {
    const sc = workUnresolvedScenario();
    sc.household.members[0] = { ...sc.household.members[0], work_unresolved: false };
    const run = simulate(tinyArea(), sc, "A");
    assert.ok(!run.unavailable.some((u) => u.agent === "h1" && u.activity === "commute"));
    assert.equal(run.trips.filter((t) => t.agent === "h1" && t.purpose === "commute").length, 0);
  });
});

function planContextScenario() {
  return tinyScenario({
    days: 7, background: 0,
    household: { members: [
      { id: "m1", label: "구성원 1", role: "adult",
        work: { type: "station_ride", station_name: "중앙역", ride_minutes: 20,
          ride_minutes_source: "user_assumption" },
        workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        errands_per_week: { supermarket: 1, convenience: 0 },
        park_walks_per_week: 2, clinic_visits_per_month: 1,
        plan_context: "주 2회 장보기 확정 / 저녁 산책 희망" },
    ] },
  });
}

describe("47m confirmed plan causes are never customer input", () => {
  it("plan_context member uses routine origin and 확정 계획 wording", () => {
    const run = simulate(tinyArea(), planContextScenario(), "A");
    const causes = [
      ...run.trips.filter((t) => t.agent === "h1").map((t) => t.cause),
      ...run.aways.filter((a) => a.agent === "h1").map((a) => a.cause),
    ].filter(Boolean);
    assert.ok(causes.length > 0);
    assert.ok(causes.every((c) => c.type !== "input"), "no customer-input origin on a confirmed plan");
    assert.ok(causes.every((c) => !c.text.includes("고객 입력")));
    assert.ok(causes.some((c) => c.text.includes("확정 계획")));
    const ids = new Set(run.decisions.map((d) => d.id));
    assert.ok(ids.size > 0 && [...ids].every((id) => typeof id === "string"));
    for (const c of causes.filter((c) => c.type === "decision")) {
      assert.ok(ids.has(c.decision_id), `decision cause keeps its id: ${c.decision_id}`);
    }
  });
});
