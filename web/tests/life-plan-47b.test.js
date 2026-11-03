import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLifePlanInput, validateLifePlan, confirmLifePlan, applyLifePlan,
  lifePlanExplanation, summarizePlanRun, countWeekdays, stableStringify,
  LEGACY_SCHOOL_PROXY_NOTICE,
} from "../src/life/plan.js";
import { LIFE_PLAN_PROMPT, lifePlanPrompt, writeLifePlan } from "../src/consult/life-plan.js";

function baseScenario() {
  return {
    start_date: "2026-11-02", days: 30, seed: 7,
    homes: [{ label: "Home A" }, { label: "Home B" }],
    household: { members: [
      { id: "h1", label: "A", role: "office worker",
        work: { type: "office", place: "Downtown" }, workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      { id: "h2", label: "B", role: "remote worker",
        work: { type: "remote" }, workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"], cafe_visits_per_week: 3 },
    ] },
  };
}

function inputOf(scenario, { profile = {}, messages = [], lang = "en" } = {}) {
  return buildLifePlanInput({ scenario, profile, messages, lang });
}

function emptyRaw(input) {
  return {
    members: input.members.map((m) => ({ id: m.id, changes: [] })),
    observations: [], questions: [], unmodeled: [],
  };
}

describe("buildLifePlanInput", () => {
  it("bounds members and keeps ids, workplaces, homes, dates", () => {
    const input = inputOf(baseScenario());
    assert.equal(input.members.length, 2);
    assert.deepEqual(input.members.map((m) => m.id), ["h1", "h2"]);
    assert.equal(input.members[0].work.place, "Downtown");
    assert.equal(input.homes.length, 2);
    assert.equal(input.start_date, "2026-11-02");
    assert.equal(input.days, 30);
    assert.match(input.input_signature, /^lp1-[0-9a-f]{8}$/);
  });

  it("rejects more than 8 members", () => {
    const s = baseScenario();
    s.household.members = Array.from({ length: 9 }, (_, i) => ({ id: `h${i}` }));
    assert.throws(() => inputOf(s), /at most 8/);
  });

  it("treats scenario routine values as assumptions, not stated facts", () => {
    const input = inputOf(baseScenario());
    assert.equal(input.members[1].assumptions.cafe_visits_per_week, 3);
    assert.deepEqual(input.members[1].assumptions.workdays, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    assert.deepEqual(input.stated_fields, {});
    // So a model cannot launder the stereotype (remote worker + cafes)
    // into a "stated" change without user text or a user-sourced profile.
    const raw = emptyRaw(input);
    raw.members[1].changes.push({ field: "cafe_visits_per_week", value: 3, basis: "stated", evidence: "remote" });
    assert.throws(() => validateLifePlan(raw, input), /stated evidence/);
  });

  it("records only user-sourced profile values as stated fields", () => {
    const profile = { h1: { workdays: { value: ["Mon"], source: "system-default" } } };
    const input = inputOf(baseScenario(), { profile });
    assert.deepEqual(input.profile_values, { h1: { workdays: ["Mon"] } });
    assert.deepEqual(input.stated_fields, {});
  });

  it("caps evidence at the last 12 user messages / 12000 chars and ignores non-user roles", () => {
    const messages = [{ role: "assistant", content: "not evidence" }];
    for (let i = 0; i < 15; i++) messages.push({ role: "user", content: `user-note-${i} ` + "x".repeat(1000) });
    const input = inputOf(baseScenario(), { messages });
    assert.equal(input.user_texts.length, 12);
    assert.ok(input.user_texts.join("").length <= 12000);
    assert.ok(!input.user_texts.join("").includes("not evidence"));
    assert.ok(input.user_texts.join("").includes("user-note-14"));
  });

  it("changes signature when homes, dates, or profile change", () => {
    const a = inputOf(baseScenario());
    const b = inputOf({ ...baseScenario(), homes: [{ label: "Other" }] });
    const c = inputOf({ ...baseScenario(), days: 7 });
    const d = inputOf(baseScenario(), { profile: { h1: { workdays: { value: ["Mon"], source: "user" } } } });
    assert.notEqual(a.input_signature, b.input_signature);
    assert.notEqual(a.input_signature, c.input_signature);
    assert.notEqual(a.input_signature, d.input_signature);
    assert.equal(a.input_signature, inputOf(baseScenario()).input_signature);
  });
});

describe("mixed households share one plan, never one persona", () => {
  it("two adults with different weekdays and preferences", () => {
    const s = baseScenario();
    const messages = [
      { role: "user", content: "I work Mon Wed Fri and my partner works Tue Thu." },
      { role: "user", content: "I love quiet mornings with coffee." },
    ];
    const input = inputOf(s, { messages });
    const raw = emptyRaw(input);
    raw.members[0].changes.push(
      { field: "workdays", value: ["Mon", "Wed", "Fri"], basis: "stated", evidence: "Mon Wed Fri" },
      { field: "preferences", value: "quiet mornings with coffee", basis: "stated", evidence: "quiet mornings with coffee" },
    );
    raw.members[1].changes.push(
      { field: "workdays", value: ["Tue", "Thu"], basis: "stated", evidence: "Tue Thu" },
    );
    raw.observations.push({ code: "commute", member_ids: ["h1", "h2"], reason: "Different office weekdays split the commute load." });
    const plan = validateLifePlan(raw, input);
    assert.equal(plan.members[0].changes.length, 2);
    assert.equal(plan.members[1].changes[0].value.length, 2);
  });

  it("four-person household with differently aged children and unknown actual schools", () => {
    const s = baseScenario();
    s.household.members.push(
      { id: "h3", label: "Child 9", role: "child", schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      { id: "h4", label: "Child 15", role: "child", schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    );
    const messages = [{ role: "user", content: "Kids are 9 and 15; we have not chosen schools yet." }];
    const input = inputOf(s, { messages });
    const raw = emptyRaw(input);
    // Grade/age alone never establishes assignment: schooldays stay a
    // proposal and the unknown school is a question, not an invention.
    raw.members[2].changes.push(
      { field: "schooldays", value: ["Mon", "Tue", "Wed", "Thu", "Fri"], basis: "proposal", evidence: "" });
    raw.members[3].changes.push(
      { field: "schooldays", value: ["Mon", "Tue", "Wed", "Thu", "Fri"], basis: "proposal", evidence: "" });
    raw.questions.push("Which schools will the 9-year-old and 15-year-old actually attend?");
    raw.observations.push({ code: "school", member_ids: ["h3", "h4"], reason: "Both children may need weekday school legs once schools are known." });
    const plan = validateLifePlan(raw, input);
    assert.equal(plan.questions.length, 1);
    assert.throws(() => confirmLifePlan(plan, input), /questions block/);
  });

  it("fully remote member uses commute none, never an invented destination", () => {
    const messages = [{ role: "user", content: "B is fully remote with no commute." }];
    const input = inputOf(baseScenario(), { messages });
    const raw = emptyRaw(input);
    raw.members[1].changes.push({ field: "commute", value: "none", basis: "stated", evidence: "no commute" });
    const plan = validateLifePlan(raw, input);
    const confirmed = confirmLifePlan(plan, input);
    const next = applyLifePlan(baseScenario(), confirmed, input);
    assert.deepEqual(next.household.members[1].work, { type: "none" });
    assert.equal(next.household.members[1].commute, "none");
    const exp = lifePlanExplanation(plan, next, "en");
    assert.equal(exp.members.find((m) => m.id === "h2").work_days, 0);
    assert.ok(exp.members.find((m) => m.id === "h1").work_days > 0);
  });

  it("senior who still works keeps stated workdays; night shift goes to unmodeled", () => {
    const s = baseScenario();
    s.household.members = [{ id: "h1", label: "Elder", role: "senior", workdays: ["Mon", "Wed"] }];
    const messages = [{ role: "user", content: "Grandfather still works Mon and Wed. He also does night shifts." }];
    const input = inputOf(s, { messages });
    const raw = emptyRaw(input);
    raw.members[0].changes.push({ field: "workdays", value: ["Mon", "Wed"], basis: "stated", evidence: "works Mon and Wed" });
    raw.unmodeled.push("Night shifts cannot be simulated; only daytime weekday legs are modeled.");
    const plan = validateLifePlan(raw, input);
    assert.equal(plan.unmodeled.length, 1);
    // No invented clinic visits for the senior.
    const bad = emptyRaw(input);
    bad.members[0].changes.push({ field: "clinic_visits_per_month", value: 4, basis: "stated", evidence: "senior" });
    assert.throws(() => validateLifePlan(bad, input), /stated evidence/);
  });

  it("pet owner gets no invented vet visits; multigenerational errands stay stated", () => {
    const s = baseScenario();
    s.household.members.push({ id: "h3", label: "Dog", role: "pet" });
    const profile = { h3: { errands_per_week: { value: { supermarket: 2, convenience: 1 }, source: "user" } } };
    const messages = [{ role: "user", content: "Grandmother buys groceries twice a week." }];
    const input = inputOf(s, { profile, messages });
    const raw = emptyRaw(input);
    raw.members[2].changes.push({
      field: "errands_per_week", value: { supermarket: 2, convenience: 1 },
      basis: "stated", evidence: stableStringify({ supermarket: 2, convenience: 1 }),
    });
    const plan = validateLifePlan(raw, input);
    assert.deepEqual(plan.members[2].changes[0].value, { supermarket: 2, convenience: 1 });
    const forged = emptyRaw(input);
    forged.members[2].changes.push({ field: "vet_visits_per_month", value: 2, basis: "stated", evidence: "has a dog" });
    assert.throws(() => validateLifePlan(forged, input), /stated evidence/);
  });

  it("one combined scenario (shift + remote + children + senior + pet) validates together", () => {
    const s = {
      start_date: "2026-11-02", days: 30, seed: 1, homes: [{ label: "X" }],
      household: { members: [
        { id: "h1", label: "Shift", role: "worker" },
        { id: "h2", label: "Remote", role: "worker", work: { type: "remote" } },
        { id: "h3", label: "Kid", role: "child" },
        { id: "h4", label: "Senior", role: "senior" },
        { id: "h5", label: "Dog", role: "pet" },
      ] },
    };
    const messages = [{ role: "user", content: "Remote worker stays home. Senior walks the park often." }];
    const input = inputOf(s, { messages });
    const raw = emptyRaw(input);
    raw.members[1].changes.push({ field: "commute", value: "none", basis: "stated", evidence: "stays home" });
    raw.members[3].changes.push({ field: "park_walks_per_week", value: 5, basis: "proposal", evidence: "" });
    raw.observations.push(
      { code: "remote_days", member_ids: ["h2"], reason: "Remote member has no work travel legs." },
      { code: "walks", member_ids: ["h4"], reason: "Proposed frequent park walks for the senior." });
    raw.unmodeled.push("Shift times outside daytime legs are not modeled.");
    const plan = validateLifePlan(raw, input);
    assert.equal(plan.members.length, 5);
    assert.equal(plan.observations.length, 2);
  });
});

describe("strict validation", () => {
  it("rejects unknown, duplicate, and missing members", () => {
    const input = inputOf(baseScenario());
    const ghost = emptyRaw(input);
    ghost.members[0].id = "hx";
    assert.throws(() => validateLifePlan(ghost, input), /unknown member/);
    const dup = emptyRaw(input);
    dup.members[1].id = "h1";
    assert.throws(() => validateLifePlan(dup, input), /exactly once|duplicate/);
    const short = emptyRaw(input);
    short.members.pop();
    assert.throws(() => validateLifePlan(short, input), /exactly once/);
  });

  it("rejects unsupported fields, unsafe commute values, and extra keys instead of dropping them", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "drive 20 minutes downtown" }] });
    for (const field of ["travel_minutes", "destination", "route", "night_shift", "school_name"]) {
      const raw = emptyRaw(input);
      raw.members[0].changes.push({ field, value: 1, basis: "proposal", evidence: "" });
      assert.throws(() => validateLifePlan(raw, input), /unsupported field/);
    }
    const commute = emptyRaw(input);
    commute.members[0].changes.push({ field: "commute", value: "Downtown 20 minutes", basis: "proposal", evidence: "" });
    assert.throws(() => validateLifePlan(commute, input), /only "none"/);
    const extra = emptyRaw(input);
    extra.totals = { trips: 99 };
    assert.throws(() => validateLifePlan(extra, input), /unsupported top-level/);
    const extraKey = emptyRaw(input);
    extraKey.members[0].changes.push({ field: "home_office", value: true, basis: "proposal", evidence: "", minutes: 30 });
    assert.throws(() => validateLifePlan(extraKey, input), /only \{field, value, basis, evidence\}/);
  });

  it("enforces every range and size boundary", () => {
    const input = inputOf(baseScenario());
    const cases = [
      ["preferences", "x".repeat(501)], ["workdays", []], ["workdays", ["Mon", "Mon"]],
      ["workdays", ["Funday"]], ["errands_per_week", { supermarket: 8, convenience: 0 }],
      ["errands_per_week", { supermarket: 1 }], ["park_walks_per_week", 8],
      ["clinic_visits_per_month", 32], ["cafe_visits_per_week", 6], ["vet_visits_per_month", 5],
      ["home_office", "yes"], ["dog_walk_morning", 1],
    ];
    for (const [field, value] of cases) {
      const raw = emptyRaw(input);
      raw.members[0].changes.push({ field, value, basis: "proposal", evidence: "" });
      assert.throws(() => validateLifePlan(raw, input), /life-plan:/, `field ${field} should throw`);
    }
    const many = emptyRaw(input);
    many.members[0].changes = Array.from({ length: 16 }, () => ({ field: "home_office", value: true, basis: "proposal", evidence: "" }));
    assert.throws(() => validateLifePlan(many, input), /at most 15/);
    const obs = emptyRaw(input);
    obs.observations = Array.from({ length: 9 }, (_, i) => ({ code: "walks", member_ids: ["h1"], reason: `r${i}` }));
    assert.throws(() => validateLifePlan(obs, input), /at most 8 observations/);
    const q = emptyRaw(input);
    q.questions = Array.from({ length: 9 }, (_, i) => `q${i}`);
    assert.throws(() => validateLifePlan(q, input), /questions/);
    const u = emptyRaw(input);
    u.unmodeled = ["x".repeat(301)];
    assert.throws(() => validateLifePlan(u, input), /exceeds 300/);
    const code = emptyRaw(input);
    code.observations.push({ code: "safety_score", member_ids: ["h1"], reason: "composite" });
    assert.throws(() => validateLifePlan(code, input), /unknown code/);
    const ref = emptyRaw(input);
    ref.observations.push({ code: "walks", member_ids: ["hx"], reason: "ghost" });
    assert.throws(() => validateLifePlan(ref, input), /unknown member/);
  });

  it("rejects forged stated evidence but accepts exact user quotes and exact profile values", () => {
    const profile = { h1: { park_walks_per_week: { value: 4, source: "user" } } };
    const messages = [{ role: "user", content: "I walk the park every morning." }];
    const input = inputOf(baseScenario(), { profile, messages });
    const forged = emptyRaw(input);
    forged.members[0].changes.push({ field: "park_walks_per_week", value: 3, basis: "stated", evidence: "user said they walk daily" });
    assert.throws(() => validateLifePlan(forged, input), /exact user quote/);
    // Exact substring of the user message works.
    const quoted = emptyRaw(input);
    quoted.members[0].changes.push({ field: "park_walks_per_week", value: 3, basis: "stated", evidence: "walk the park" });
    assert.equal(validateLifePlan(quoted, input).members[0].changes[0].basis, "stated");
    // Exact user-sourced profile value works for non-preference fields.
    const prof = emptyRaw(input);
    prof.members[0].changes.push({ field: "park_walks_per_week", value: 4, basis: "stated", evidence: "4" });
    assert.equal(validateLifePlan(prof, input).members[0].changes[0].basis, "stated");
    // Arbitrary profile JSON is not a quote: unquoted text fails even with a matching profile.
    const fakeProfile = emptyRaw(input);
    fakeProfile.members[0].changes.push({ field: "clinic_visits_per_month", value: 2, basis: "stated", evidence: "clinic_visits_per_month: 2 (profile)" });
    assert.throws(() => validateLifePlan(fakeProfile, input), /exact user quote/);
  });

  it("normalizes plans with signature, source, unconfirmed status, and days", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    assert.equal(plan.input_signature, input.input_signature);
    assert.equal(plan.source, "muse");
    assert.equal(plan.confirmed, false);
    assert.equal(plan.days, 30);
  });

  it("adds the legacy school POI-proxy notice for boolean school flags", () => {
    const s = baseScenario();
    s.nearest_school = true;
    const input = inputOf(s);
    assert.equal(input.legacy_nearest_school, true);
    const plan = validateLifePlan(emptyRaw(input), input);
    assert.ok(plan.unmodeled.includes(LEGACY_SCHOOL_PROXY_NOTICE));
  });
});

describe("confirm and apply", () => {
  it("stale signatures fail; home or profile changes invalidate confirmation", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    const other = inputOf({ ...baseScenario(), homes: [{ label: "Moved" }] });
    assert.throws(() => confirmLifePlan(plan, other), /stale/);
    assert.throws(() => applyLifePlan(baseScenario(), { ...plan, confirmed: true }, other), /stale/);
  });

  it("no confirmation means no apply, and questions block confirmation", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    assert.throws(() => applyLifePlan(baseScenario(), plan, input), /must be confirmed/);
    const q = emptyRaw(input);
    q.questions.push("What time do you leave?");
    const blocked = validateLifePlan(q, input);
    assert.throws(() => confirmLifePlan(blocked, input), /questions block/);
    const ok = confirmLifePlan(plan, input);
    assert.equal(ok.confirmed, true);
    assert.equal(plan.confirmed, false); // confirm copies, never mutates
  });

  it("apply clones deeply, preserves the rest, and never mutates originals", () => {
    const s = baseScenario();
    s.household.members[0].coordinates = { x: 1, y: 2 };
    s.criteria = { C1: "keep" };
    const before = JSON.parse(JSON.stringify(s));
    const messages = [{ role: "user", content: "I work from home on Fridays only." }];
    const input = inputOf(s, { messages });
    const raw = emptyRaw(input);
    raw.members[1].changes.push(
      { field: "home_office", value: true, basis: "stated", evidence: "work from home" },
      { field: "preferences", value: "quiet desk", basis: "proposal", evidence: "" },
    );
    const confirmed = confirmLifePlan(validateLifePlan(raw, input), input);
    const next = applyLifePlan(s, confirmed, input);
    assert.equal(next.household.members[1].home_office, true);
    assert.equal(next.household.members[1].preferences, "quiet desk");
    assert.equal(next.household.members[0].workdays.length, 5); // untouched member kept
    assert.deepEqual(next.household.members[0].coordinates, { x: 1, y: 2 });
    assert.deepEqual(next.household.members[0].work, { type: "office", place: "Downtown" });
    assert.deepEqual(next.criteria, { C1: "keep" });
    assert.equal(next.days, 30);
    assert.equal(next.seed, 7);
    assert.deepEqual(s, before); // original scenario untouched
    assert.equal(confirmed.confirmed, true);
    assert.equal(next.life_plan.source, "muse");
    assert.equal(next.life_plan.confirmed, true);
    assert.equal(next.life_plan.signature, input.input_signature);
    assert.ok(next.plan_context.length <= 1200);
  });
});

describe("explanation", () => {
  it("counts calendar workdays for 30 vs 7 days from the exact start date", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    const en30 = lifePlanExplanation(plan, baseScenario(), "en");
    assert.equal(en30.members.find((m) => m.id === "h1").work_days, 22);
    assert.ok(en30.headline.includes("30 days"));
    assert.ok(en30.summary.includes("not a forecast"));
    const s7 = { ...baseScenario(), days: 7 };
    const en7 = lifePlanExplanation(plan, s7, "en");
    assert.equal(en7.members.find((m) => m.id === "h1").work_days, 5);
    assert.ok(en7.headline.includes("7 days"));
    assert.ok(!en7.headline.includes("30 days"));
    const ko = lifePlanExplanation(plan, baseScenario(), "ko");
    assert.ok(ko.headline.includes("30일"));
  });

  it("keeps monthly_cost a financial assumption and methods measurable", () => {
    const input = inputOf(baseScenario());
    const raw = emptyRaw(input);
    raw.observations.push(
      { code: "commute", member_ids: ["h1"], reason: "Weekday office legs." },
      { code: "monthly_cost", member_ids: ["h1", "h2"], reason: "Assumed monthly housing-adjacent spend." },
    );
    const plan = validateLifePlan(raw, input);
    const exp = lifePlanExplanation(plan, baseScenario(), "en");
    assert.equal(exp.methods.length, 2);
    const money = exp.methods.find((m) => m.code === "monthly_cost").text;
    assert.ok(money.includes("financial assumption"));
    assert.ok(!money.includes("trip legs") || money.includes("never"));
    assert.ok(exp.limitation.includes("cannot prove"));
    assert.ok(!JSON.stringify(exp).includes("fatigue"));
  });
});

describe("summarizePlanRun", () => {
  function run30() {
    // Production record shape: meta.days declares the period, trips carry
    // the engine agent key, daily carries per-day engine summaries.
    const trips = [];
    let seq = 1;
    const tid = () => `t${String(seq++).padStart(6, "0")}`;
    for (let i = 0; i < 30; i++) {
      if (i % 2 === 0) trips.push({ id: tid(), agent: "h1", day: i, depart_min: 480, arrive_min: 510, purpose: "commute", distance_m: 100, minutes: 30 });
      if (i < 7) trips.push({ id: tid(), agent: "h2", day: i, depart_min: 540, arrive_min: 550, purpose: "errands", distance_m: 50, minutes: 10 });
      trips.push({ id: tid(), agent: "bg1", day: i, depart_min: 480, arrive_min: 500, purpose: "commute", distance_m: 200, minutes: 99 });
    }
    const dailyFor = () => Array.from({ length: 30 }, (_, day) =>
      ({ day, commute_walk_minutes: 1, commute_ride_minutes: 0, commute_wait_minutes: 0, trips: 1 }));
    return {
      meta: { days: 30 },
      agents: [{ key: "h1", id: "h1", household: true }, { key: "h2", id: "h2", household: true }, { key: "bg1", id: "bg1", household: false }],
      trips,
      unavailable: [],
      daily: [{ agent: "h1", days: dailyFor() }, { agent: "h2", days: dailyFor() }],
    };
  }
  it("counts legs (not visits), splits first week vs full period, and excludes background", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    const out = summarizePlanRun(run30(), plan);
    // h1 legs: 15 even days; h2 legs: 7 days. Background bg1 (30 legs) excluded.
    assert.equal(out.full_period.trips, 22);
    assert.equal(out.full_period.travel_minutes, 15 * 30 + 7 * 10);
    assert.equal(out.full_period.travel_minutes_partial, false);
    assert.equal(out.first_7_days.trips, 4 + 7);
    assert.equal(out.first_7_days.by_member.h1.trips, 4);
    assert.equal(out.first_7_days.by_purpose.errands.trips, 7);
    assert.deepEqual(out.missing.members_without_trips, []);
    // Daily summaries cover all 30 days; trip legs touch 18 distinct days.
    assert.equal(out.day_coverage.observed_days, 30);
    assert.equal(out.day_coverage.active_trip_days, 15 + 7 - 4); // union of even days and days 0..6
    assert.equal(out.day_coverage.total_days, 30);
    assert.equal(out.day_coverage.coverage_source, "daily");
    // No unavailable records were written, so nothing is missing.
    assert.equal(out.missing.unavailable_records, 0);
    assert.equal(out.missing.unavailable_days, 0);
    assert.equal(out.missing.legs_missing_minutes, 0);
    assert.equal(out.full_period.commute_minutes, 60);
    assert.equal(out.full_period.commute_minutes_partial, false);
    assert.equal(out.first_7_days.commute_minutes, 14);
  });
  it("reports missing members and days with no household legs", () => {
    const input = inputOf(baseScenario());
    const plan = validateLifePlan(emptyRaw(input), input);
    const out = summarizePlanRun({ meta: { days: 7 }, agents: [], trips: [], unavailable: [], daily: [] }, plan);
    assert.deepEqual(out.missing.members_without_trips, ["h1", "h2"]);
    assert.equal(out.day_coverage.observed_days, 0);
    assert.equal(out.day_coverage.coverage_source, "trips_only");
    assert.equal(out.missing.unavailable_days, 0);
    assert.equal(out.full_period.trips, 0);
  });
});

describe("writeLifePlan provider call", () => {
  it("sends one call with system prompt plus JSON input and returns plan with provenance", async () => {
    const input = inputOf(baseScenario());
    const valid = emptyRaw(input);
    let seen = null;
    const fakeCall = async (args) => {
      seen = args;
      return { message: { content: JSON.stringify(valid) }, usage: { prompt_tokens: 5 }, provider: "meta", model: "m1" };
    };
    const { plan, usage } = await writeLifePlan({ call: fakeCall, provider: "meta", input, lang: "en" });
    assert.equal(seen.messages.length, 2);
    assert.equal(seen.messages[0].role, "system");
    assert.ok(seen.messages[0].content.length > 100);
    assert.equal(seen.messages[1].role, "user");
    assert.deepEqual(JSON.parse(seen.messages[1].content).input_signature, input.input_signature);
    assert.ok(!("tools" in seen));
    assert.equal(seen.maxTokens, 6000);
    assert.equal(seen.timeoutMs, 60000);
    assert.equal(plan.source, "muse");
    assert.equal(usage.provider, "meta");
    assert.equal(usage.model, "m1");
  });

  it("uses baseten budgets and accepts fenced JSON", async () => {
    const input = inputOf(baseScenario());
    let seen = null;
    const fakeCall = async (args) => {
      seen = args;
      return { message: { content: "```json\n" + JSON.stringify(emptyRaw(input)) + "\n```" }, usage: {} };
    };
    const { plan, usage } = await writeLifePlan({ call: fakeCall, provider: "baseten", input, lang: "ko" });
    assert.equal(seen.maxTokens, 12000);
    assert.equal(seen.timeoutMs, 180000);
    assert.equal(plan.confirmed, false);
    assert.equal(usage.provider, "baseten");
    void plan;
  });

  it("never lets invalid JSON or an invalid plan appear successful", async () => {
    const input = inputOf(baseScenario());
    const badJSON = async () => ({ message: { content: "not json {" }, usage: {} });
    await assert.rejects(() => writeLifePlan({ call: badJSON, provider: "meta", input }), /invalid model JSON/);
    const badPlan = emptyRaw(input);
    badPlan.members[0].id = "ghost";
    const ghost = async () => ({ message: { content: JSON.stringify(badPlan) }, usage: {} });
    await assert.rejects(() => writeLifePlan({ call: ghost, provider: "meta", input }), /unknown member/);
    const down = async () => { throw new Error("timeout"); };
    await assert.rejects(() => writeLifePlan({ call: down, provider: "meta", input }), /provider call failed/);
  });

  it("prompt composes from stated needs and states the exact schema", () => {
    assert.ok(LIFE_PLAN_PROMPT.includes("persona template"));
    assert.ok(LIFE_PLAN_PROMPT.includes("commute"));
    assert.ok(LIFE_PLAN_PROMPT.includes("monthly_cost"));
    assert.ok(lifePlanPrompt("ko").includes("Korean"));
  });
});

describe("calendar helper", () => {
  it("counts weekdays from the Monday anchor without Date", () => {
    assert.deepEqual(countWeekdays("2026-11-02", 7), { Mon: 1, Tue: 1, Wed: 1, Thu: 1, Fri: 1, Sat: 1, Sun: 1 });
    const c = countWeekdays("2026-11-02", 30);
    assert.equal(c.Mon + c.Tue + c.Wed + c.Thu + c.Fri + c.Sat + c.Sun, 30);
    assert.equal(c.Mon, 5);
    assert.equal(c.Sun, 4);
  });
});
