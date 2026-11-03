import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import {
  buildLifePlanInput, validateLifePlan, confirmLifePlan, applyLifePlan,
  lifePlanExplanation,
} from "../src/life/plan.js";
import { parseScenario } from "../src/engine/scenario.js";
import { buildPrompt } from "../src/judge/context.js";

register("./jsx-loader.mjs", import.meta.url);

let React; let renderToStaticMarkup; let LifePlanCard;
before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ LifePlanCard } = await import("../src/ui/life-plan.jsx"));
});

function baseScenario() {
  return {
    start_date: "2026-11-02", days: 30, seed: 7,
    homes: [{ label: "Home A", area: "Area", complex_name: "Complex" }],
    household: { members: [
      { id: "h1", label: "A", role: "adult",
        work: { type: "station_ride", station_name: "중앙역", ride_minutes: 20, ride_minutes_source: "user_assumption" },
        workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    ] },
  };
}
function inputOf(scenario, opts = {}) {
  return buildLifePlanInput({ scenario, ...opts });
}
function hybridRaw(input) {
  return {
    members: [{ id: "h1", changes: [
      { field: "home_office_days", value: ["Tue", "Thu"], basis: "stated", evidence: "Tue Thu remote" },
    ] }],
    observations: [{ code: "remote_days", member_ids: ["h1"], reason: "Tue Thu remote." }],
    questions: [], unmodeled: [],
  };
}

describe("49d hybrid days", () => {
  it("validate->confirm->apply->parseScenario preserves the array", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "Tue Thu remote" }] });
    const plan = validateLifePlan(hybridRaw(input), input);
    const confirmed = confirmLifePlan(plan, input);
    const next = applyLifePlan(baseScenario(), confirmed, input);
    const m = next.household.members.find((x) => x.id === "h1");
    assert.deepEqual(m.home_office_days, ["Tue", "Thu"]);
    const reparsed = parseScenario(JSON.parse(JSON.stringify(next)));
    const rm = reparsed.household.members.find((x) => x.id === "h1");
    assert.deepEqual(rm.home_office_days, ["Tue", "Thu"]);
  });

  it("30d Nov2 preview: 13 onsite, 9 remote", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "Tue Thu remote" }] });
    const plan = validateLifePlan(hybridRaw(input), input);
    const confirmed = confirmLifePlan(plan, input);
    const next = applyLifePlan(baseScenario(), confirmed, input);
    const e = lifePlanExplanation(confirmed, next, "en").members.find((m) => m.id === "h1");
    assert.equal(e.work_days, 13);
    assert.equal(e.remote_days, 9);
    assert.equal(e.school_days, 0);
  });

  it("legacy full remote counts 22 remote days", () => {
    const s = baseScenario();
    s.household.members[0].home_office = true;
    const input = inputOf(s);
    const raw = { members: [{ id: "h1", changes: [] }], observations: [], questions: [], unmodeled: [] };
    const plan = validateLifePlan(raw, input);
    const e = lifePlanExplanation(plan, s, "en").members.find((m) => m.id === "h1");
    assert.equal(e.work_days, 0);
    assert.equal(e.remote_days, 22);
  });

  it("explicit [] clears legacy home_office true", () => {
    const s = baseScenario();
    s.household.members[0].home_office = true;
    const input = inputOf(s, { messages: [{ role: "user", content: "back onsite" }] });
    const raw = { members: [{ id: "h1", changes: [
      { field: "home_office_days", value: [], basis: "stated", evidence: "back onsite" },
    ] }], observations: [], questions: [], unmodeled: [] };
    const plan = validateLifePlan(raw, input);
    const confirmed = confirmLifePlan(plan, input);
    const next = applyLifePlan(s, confirmed, input);
    const e = lifePlanExplanation(confirmed, next, "en").members.find((m) => m.id === "h1");
    assert.deepEqual(next.household.members[0].home_office_days, []);
    assert.equal(e.remote_days, 0);
    assert.equal(e.work_days, 22);
  });

  it("rejects bad codes, duplicates, non-arrays, non-subsets", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "x" }] });
    for (const bad of [["Funday"], ["Tue", "Tue"], "Tue", ["Sat"]]) {
      const raw = { members: [{ id: "h1", changes: [
        { field: "home_office_days", value: bad, basis: "proposal", evidence: "" },
      ] }], observations: [], questions: [], unmodeled: [] };
      assert.throws(() => validateLifePlan(raw, input), /home_office_days/);
    }
  });

  it("rejects workdays change invalidating the existing remote set", () => {
    const s = baseScenario();
    s.household.members[0].home_office_days = ["Tue", "Thu"];
    const input = inputOf(s, { messages: [{ role: "user", content: "x" }] });
    const raw = { members: [{ id: "h1", changes: [
      { field: "workdays", value: ["Mon", "Wed", "Fri"], basis: "proposal", evidence: "" },
    ] }], observations: [], questions: [], unmodeled: [] };
    assert.throws(() => validateLifePlan(raw, input), /home_office_days/);
  });

  it("duplicate workdays would bypass subset must reject", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "x" }] });
    const raw = { members: [{ id: "h1", changes: [
      { field: "workdays", value: ["Mon", "Tue"], basis: "proposal", evidence: "" },
      { field: "home_office_days", value: ["Tue"], basis: "proposal", evidence: "" },
      { field: "workdays", value: ["Mon", "Wed"], basis: "proposal", evidence: "" },
    ] }], observations: [], questions: [], unmodeled: [] };
    assert.throws(() => validateLifePlan(raw, input), /repeats field/);
  });

  it("stated change needs a user quote", () => {
    const input = inputOf(baseScenario());
    assert.throws(() => validateLifePlan(hybridRaw(input), input), /stated evidence/);
  });

  it("SSR card contains 13 onsite and 9 remote", () => {
    const input = inputOf(baseScenario(), { messages: [{ role: "user", content: "Tue Thu remote" }] });
    const plan = validateLifePlan(hybridRaw(input), input);
    const out = renderToStaticMarkup(React.createElement(LifePlanCard, { plan, input, scenario: baseScenario(), lang: "en" }));
    assert.match(out, /13 onsite workdays/);
    assert.match(out, /9 remote days/);
  });

  it("daily context sees remote Tue then working Wed", () => {
    const member = { role: "adult", workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"], home_office_days: ["Tue", "Thu"] };
    const shell = { kind: "shop_choice", agent: "h1", day: 1, minute: 540, options: [{ key: "home", label: "Home" }] };
    const tue = buildPrompt({ member, agentLabel: "h1", date: "2026-11-03", weekday: "Tue", minute: 540, shell });
    const wed = buildPrompt({ member, agentLabel: "h1", date: "2026-11-04", weekday: "Wed", minute: 540, shell });
    assert.match(tue.user, /remote workday/);
    assert.match(wed.user, /working day/);
    assert.ok(!wed.user.includes("remote workday"));
  });
});
