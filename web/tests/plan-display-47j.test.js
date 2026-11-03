// 47j: review/result display contract — effective conditions, real units.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import {
  buildLifePlanInput, validateLifePlan, lifePlanExplanation, summarizePlanRun, countWeekdays,
} from "../src/life/plan.js";

register("./jsx-loader.mjs", import.meta.url);

let React; let renderToStaticMarkup; let LifePlanCard; let LifePlanRunSummary; let previewEffectiveScenario;
before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ LifePlanCard, LifePlanRunSummary, previewEffectiveScenario } = await import("../src/ui/life-plan.jsx"));
});

const SCENARIO = {
  name: "tiny", start_date: "2026-11-02", days: 30, seed: 7, background: 0,
  household: { members: [
    { id: "m1", label: "Mina", role: "adult",
      work: { type: "station_ride", place: { name: "판교역 인근", station: "판교" }, station: "판교" },
      workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { id: "m2", label: "Jun", role: "adult", work_unresolved: true, workdays: ["Tue", "Thu"] },
    { id: "m3", label: "Child", role: "child",
      schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      school: { mode: "unresolved", level: "elementary" } },
  ] },
  homes: [{ label: "A" }, { label: "B" }],
};
const MESSAGES = [{ role: "user", content: "조용한 주거 선호, 야근 잦음" }];

function setup() {
  const input = buildLifePlanInput({ scenario: SCENARIO, profile: {}, messages: MESSAGES, lang: "en" });
  const raw = {
    members: [
      { id: "m1", changes: [
        { field: "workdays", value: ["Tue", "Thu"], basis: "proposal", evidence: "" },
        { field: "preferences", value: "조용한 주거 선호", basis: "stated", evidence: "조용한 주거 선호" },
      ] },
      { id: "m2", changes: [{ field: "commute", value: "member:m1", basis: "proposal", evidence: "" }] },
      { id: "m3", changes: [] },
    ],
    observations: [{ code: "commute", member_ids: ["m1", "m2"], reason: "Shared Pangyo commute." }],
    questions: ["Which school will Child actually attend?"],
    unmodeled: ["Parking fees are not modelled."],
    review: [],
  };
  const plan = validateLifePlan(raw, input);
  return { input, plan };
}

function html(el) { return renderToStaticMarkup(React.createElement(el.type, el.props)); }

describe("47j review shows effective conditions, not pre-patch values", () => {
  it("counts AFTER patches: Tue/Thu over 30d from Mon Nov 2 (not the base 22)", () => {
    const { input, plan } = setup();
    const before = lifePlanExplanation(plan, SCENARIO, "en").members.find((m) => m.id === "m1");
    assert.equal(before.work_days, 22);
    const preview = previewEffectiveScenario(plan, input, SCENARIO);
    // Tue/Thu x 30 days from Monday: 5 Tuesdays + 4 Thursdays = 9.
    const tueThu = countWeekdays("2026-11-02", 30).Tue + countWeekdays("2026-11-02", 30).Thu;
    assert.equal(tueThu, 9);
    const after = lifePlanExplanation(plan, preview, "en").members.find((m) => m.id === "m1");
    assert.equal(after.work_days, tueThu);
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.match(out, /9 workdays/);
    assert.ok(!out.includes("22 workdays"), "review must not show the stale pre-patch count");
    // Pure projection: inputs untouched.
    assert.deepEqual(SCENARIO.household.members[0].workdays, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    assert.equal(input.members[1].work_unresolved, true);
  });

  it("known commute ref copies the destination (vs 0 before), no internal ids", () => {
    const { input, plan } = setup();
    const preview = previewEffectiveScenario(plan, input, SCENARIO);
    const m2 = preview.household.members.find((m) => m.id === "m2");
    assert.equal(m2.work_unresolved, false);
    assert.equal(m2.work.station, "판교");
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.match(out, /Same workplace as Mina \(Pangyo\)/);
    assert.ok(!out.includes("member:m1"), "no raw member ref may leak");
    assert.ok(!out.includes("[object Object]"), "work objects must render readable");
    assert.ok(!out.includes("station_ride"), "raw mode ids must be localized");
    assert.match(out, /station ride/);
  });

  it("unresolved school is not-confirmed, never a nearby proxy", () => {
    const { input, plan } = setup();
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.match(out, /not confirmed — awaiting details/);
    assert.ok(!out.includes("Nearby"), "unresolved school must not claim a nearby route");
    assert.ok(!out.includes("proxy"), "unresolved school must not claim a proxy");
    const ko = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "ko" }));
    assert.match(ko, /미확인 — 세부 정보 대기 중/);
    assert.ok(!ko.includes("학교 경로"), "ko unresolved school must not claim a school route");
    assert.match(ko, /화·목/, "ko weekday lists are localized");
    assert.ok(!ko.includes("station_ride"), "no raw mode ids in ko");
  });

  it("matched basis: stated / proposal / base assumption each labelled", () => {
    const { input, plan } = setup();
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.match(out, /You stated/);
    assert.match(out, /Proposed assumption/);
    assert.match(out, /Base assumption/);
  });

  it("blocked questions still review the schedule but disable confirm", () => {
    const { input, plan } = setup();
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.match(out, /Which school will Child actually attend\?/);
    assert.match(out, /Parking fees are not modelled\./);
    assert.match(out, /9 workdays/);
    assert.match(out, /disabled/);
  });

  it("long assumption strings stay readable, never raw JSON", () => {
    const { input } = setup();
    const long = "가".repeat(300);
    const plan = validateLifePlan({
      members: [
        { id: "m1", changes: [{ field: "preferences", value: long, basis: "proposal", evidence: "" }] },
        { id: "m2", changes: [] },
        { id: "m3", changes: [] },
      ],
      observations: [], questions: [], unmodeled: [],
    }, input);
    const out = html(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en" }));
    assert.ok(out.includes(long), "long value renders in full");
    assert.ok(!out.includes('{"'), "no raw JSON may leak into the table");
  });
});

describe("47j run summary: map A/B, real units, partial is partial", () => {
  function runs() {
    const { plan } = setup();
    const runA = {
      total_days: 30,
      agents: [{ id: "m1", household: true }, { id: "m2", household: true }],
      trips: [
        { day: 0, member: "m1", purpose: "commute", minutes: 20 },
        { day: 1, member: "m1", purpose: "commute", minutes: 30 },
        { day: 2, member: "m1", purpose: "errands" },
      ],
      daily: [{ agent: "m1", days: [
        { day: 0, commute_walk_minutes: 10, commute_ride_minutes: 20, commute_wait_minutes: 5 },
        { day: 8, commute_walk_minutes: 5, commute_ride_minutes: 5, commute_wait_minutes: 5 },
      ] }],
      unavailable: [{ agent: "m1", day: 3 }, { agent: "m2", day: 3 }],
    };
    const runB = {
      total_days: 30,
      agents: [{ id: "m1", household: true }],
      trips: [{ day: 0, member: "m1", purpose: "commute", minutes: 10 }],
    };
    return { plan, sumA: summarizePlanRun(runA, plan), sumB: summarizePlanRun(runB, plan) };
  }

  it("supports a per-home map with explicit headers and different leg counts", () => {
    const { sumA, sumB } = runs();
    assert.equal(sumA.full_period.trips, 3);
    assert.equal(sumB.full_period.trips, 1);
    const out = html(React.createElement(LifePlanRunSummary,
      { summaries: { A: sumA, B: sumB }, labels: ["A", "B"], lang: "en" }));
    assert.match(out, />A</); assert.match(out, />B</);
    assert.match(out, /Recorded travel legs: 3/);
    assert.match(out, /Recorded travel legs: 1/);
    // Direct single-shape still works.
    const single = html(React.createElement(LifePlanRunSummary,
      { summaries: sumA, labels: { m1: "Mina", m2: "Jun" }, lang: "en" }));
    assert.match(single, /First 7 days/);
    assert.match(single, /Mina/);
  });

  it("trip-leg minutes exclude rail/wait; commute is separate and partial is labelled", () => {
    const { sumA } = runs();
    assert.equal(sumA.full_period.travel_minutes, 50);
    assert.equal(sumA.full_period.travel_minutes_partial, true);
    assert.equal(sumA.full_period.commute_minutes, 50);
    const out = html(React.createElement(LifePlanRunSummary,
      { summaries: sumA, labels: { m1: "Mina", m2: "Jun" }, lang: "en" }));
    assert.match(out, /rail and wait are not included/);
    assert.match(out, /Commute \(walk \+ ride \+ wait\): 50 min/);
    assert.match(out, /partial — known subtotal/);
    assert.match(out, /1 days with unavailable activities/);
    assert.match(out, /2\/30 observed days/);
  });

  it("zero trips still show missing data and unavailable commute; trips-only never claims full observation", () => {
    const { plan } = setup();
    const empty = summarizePlanRun({ total_days: 7, trips: [] }, plan);
    assert.equal(empty.full_period.trips, 0);
    assert.equal(empty.full_period.commute_minutes, null);
    const out = html(React.createElement(LifePlanRunSummary, { summaries: empty, lang: "en", input: null }));
    assert.match(out, /No recorded trips/);
    assert.match(out, /No recorded trips for/);
    assert.match(out, /Commute unavailable/);
    assert.match(out, /trip days only — not full-period observation/);
    // Actual 0 known complete stays 0, not unavailable.
    assert.match(out, /recorded travel: 0 min/);
  });

  it("member names come from input when no label map is given; purposes are localized", () => {
    const { input, plan } = setup();
    const sum = summarizePlanRun({ total_days: 7, trips: [{ day: 0, member: "m1", purpose: "commute", minutes: 5 }] }, plan);
    const out = html(React.createElement(LifePlanRunSummary, { summaries: sum, lang: "en", input }));
    assert.match(out, /Mina/);
    assert.ok(!out.includes("Member m1") && !out.includes("Me"), "never invent member names");
    const ko = html(React.createElement(LifePlanRunSummary, { summaries: sum, lang: "ko", input }));
    assert.match(ko, /출퇴근/);
  });
});
