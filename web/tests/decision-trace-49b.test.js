// 49b: saved Muse decision examples — selection contract (node:test).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeHouseholdDecisionExamples } from "../src/chat/decision-trace.js";

const AGENTS = [
  { key: "h1", id: "m1", label: "나", role: "adult", household: true },
  { key: "h2", id: "m2", label: "배우자", role: "adult", household: true },
];
const MEMBERS = [
  { id: "m1", label: "나", preferences: "조용한 주거 선호" },
  { id: "m2", label: "배우자" },
];

function runWith(decisions) {
  return { agents: AGENTS, decisions };
}

describe("49b decision-trace selection", () => {
  it("covers each member first, prefers changed defaults", () => {
    const run = runWith([
      { id: "a", agent: "h1", day: 0, minute: 100, kind: "shop_choice", options: [{ key: "s0", label: "A", minutes: 2 }], default_key: "s0", chosen_key: "s0", chosen_by: "model", reason_ko: "가까워서" },
      { id: "b", agent: "h1", day: 0, minute: 200, kind: "shop_choice", options: [{ key: "s0", label: "A", minutes: 2 }, { key: "s1", label: "B", minutes: 5 }], default_key: "s0", chosen_key: "s1", chosen_by: "model", reason_ko: "B가 좋아서" },
      { id: "c", agent: "h2", day: 0, minute: 150, kind: "park_or_home", options: [{ key: "home", label: "집", minutes: 0 }], default_key: "home", chosen_key: "home", chosen_by: "rule", reason_ko: "쉬기" },
    ]);
    const out = makeHouseholdDecisionExamples(run, MEMBERS);
    assert.equal(out.length, 2);
    const h1 = out.find((e) => e.agent === "h1");
    assert.equal(h1.id, "b");
    assert.equal(h1.isDefaultChange, true);
    assert.equal(h1.memberLabel, "나");
    assert.equal(h1.memberPreferences, "조용한 주거 선호");
    const h2 = out.find((e) => e.agent === "h2");
    assert.equal(h2.follow, 2);
    assert.equal(h2.memberPreferences, null);
  });

  it("unique ids, stable chronology, at most 4 with kind diversity", () => {
    const decisions = [];
    for (let i = 0; i < 6; i++) {
      decisions.push({ id: `d${i % 3}`, agent: "h1", day: 0, minute: 100 + i, kind: i < 3 ? "shop_choice" : "park_or_home", options: [{ key: "s0", label: "A", minutes: 1 }], default_key: "s0", chosen_key: "s0", chosen_by: "model", reason_ko: `r${i}` });
    }
    const out = makeHouseholdDecisionExamples(runWith(decisions), MEMBERS);
    assert.ok(out.length <= 4);
    assert.equal(new Set(out.map((e) => e.id)).size, out.length);
    const mins = out.map((e) => e.minute);
    assert.deepEqual([...mins].sort((a, b) => a - b), mins);
  });

  it("stay-home plan exact, unknown minutes null never 0", () => {
    const run = runWith([
      { id: "home1", agent: "h1", day: 1, minute: 500, kind: "park_or_home", plan: [], options: [{ key: "home", label: "집", minutes: 0, distance_m: 0 }], default_key: "home", chosen_by: "model", reason_ko: "쉬기" },
      { id: "unk", agent: "h2", day: 1, minute: 600, kind: "shop_choice", options: [{ key: "s0", label: "A" }, { key: "s1", label: "B", minutes: 4.4 }], default_key: "s0", chosen_key: "s0", chosen_by: "model", reason_ko: "그냥" },
    ]);
    const out = makeHouseholdDecisionExamples(run, MEMBERS);
    const home = out.find((e) => e.id === "home1");
    assert.deepEqual(home.plan, []);
    assert.equal(home.isDefaultChange, false);
    assert.equal(home.chosen_minutes, 0);
    const u = out.find((e) => e.id === "unk");
    assert.equal(u.chosen_minutes, null);
    assert.notEqual(u.chosen_minutes, 0);
  });

  it("does not mutate inputs and tolerates old payloads", () => {
    const decisions = [{ agent: "h1", day: 0, minute: 10, kind: "shop_choice", chosen_key: "s0", chosen_by: "model", reason_ko: "옛 기록" }];
    const run = runWith(decisions);
    const snap = JSON.stringify(run);
    const out = makeHouseholdDecisionExamples(run, MEMBERS);
    assert.equal(JSON.stringify(run), snap);
    assert.equal(out.length, 1);
    assert.equal(out[0].options.length, 0);
    assert.equal(out[0].default_key, null);
    assert.equal(out[0].chosen_minutes, null);
  });
});
