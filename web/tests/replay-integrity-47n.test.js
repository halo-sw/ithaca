// 47n: replays restore the actual recorded run, never a rule recompute.
// A valid doc.runBundle is saved exactly (worker 0 calls); strict
// (muse/recorded-choice) records without a valid bundle or matching
// stored record fail closed (worker 0 calls); legacy rule-only records
// rebuild through the worker exactly once.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

describe("47n recorded-run integrity", () => {
  let replayRunPlan;
  let restoreReplayRun;
  let validateRunBundle;
  let replayRequiresStrict;
  before(async () => {
    ({ replayRunPlan, restoreReplayRun, validateRunBundle, replayRequiresStrict } =
      await import("../src/chat/recording.js"));
  });

  const scenario = () => ({
    name: "t", start_date: "2026-11-02", days: 30, seed: 7,
    household: { members: [] }, homes: [],
  });
  const runFor = (label, sc) => ({
    meta: { home: label, seed: sc.seed, start_date: sc.start_date, days: sc.days },
    trips: [{ agent: "h1" }], decisions: [], daily: [{ day: 1 }],
  });
  const runsFor = (sc) => ({ A: runFor("A", sc), B: runFor("B", sc) });
  const simData = (customId, extra = {}) => ({
    status: "done", customId, labels: ["A", "B"], names: { A: "a", B: "b" },
    moneyDoc: { days: 30 }, moneyMissing: "", ...extra,
  });
  const docOf = (sc, data, extra = {}) => ({
    scenario: sc, messages: [{ role: "assistant", kind: "simulation", data }], ...extra,
  });
  const bundleOf = (sc, customId, runs, extra = {}) => ({
    id: customId, scenario: structuredClone(sc), runs,
    labels: ["A", "B"], names: { A: "a", B: "b" },
    moneyDoc: { days: 30 }, moneyMissing: "", ...extra,
  });
  const fakeDeps = ({ stored = null, workerRuns = null } = {}) => {
    const calls = { worker: 0, saved: [] };
    return {
      calls,
      loadCustomRun: async () => stored,
      saveCustomRun: async (rec) => { calls.saved.push(rec); return rec.id; },
      runWorker: async () => { calls.worker++; return workerRuns; },
    };
  };

  it("legacy rule-only record rebuilds through the worker once", async () => {
    const sc = scenario();
    const plan = replayRunPlan(docOf(sc, simData("c1")));
    assert.ok(plan, "plan");
    assert.equal(plan.requiresStrict, false);
    assert.equal(plan.runBundle, null);
    const deps = fakeDeps({ workerRuns: runsFor(sc) });
    assert.equal(await restoreReplayRun(plan, deps), true);
    assert.equal(deps.calls.worker, 1);
    assert.equal(deps.calls.saved.length, 1);
    assert.equal(deps.calls.saved[0].id, "c1");
  });

  it("strict muse record without a bundle fails closed, worker never runs", async () => {
    const sc = scenario();
    const plan = replayRunPlan(docOf(sc, simData("c2", { decisionMode: "muse" })));
    assert.equal(plan.requiresStrict, true);
    const deps = fakeDeps();
    assert.equal(await restoreReplayRun(plan, deps), false);
    assert.equal(deps.calls.worker, 0);
    assert.equal(deps.calls.saved.length, 0);
  });

  it("strict record with a valid bundle saves it exactly, worker 0 calls", async () => {
    const sc = scenario();
    const runs = runsFor(sc);
    const bundle = bundleOf(sc, "c3", runs);
    const plan = replayRunPlan(docOf(sc, simData("c3", { decisionMode: "muse" }), { runBundle: bundle }));
    assert.ok(plan && plan.runBundle, "bundle accepted");
    const deps = fakeDeps();
    assert.equal(await restoreReplayRun(plan, deps), true);
    assert.equal(deps.calls.worker, 0);
    assert.equal(deps.calls.saved.length, 1);
    assert.deepEqual(deps.calls.saved[0].runs, runs);
    assert.equal(deps.calls.saved[0].id, "c3");
  });

  it("mismatched seed/customId bundles are rejected, strict fails closed", async () => {
    const sc = scenario();
    const runs = runsFor(sc);
    const wrongSeed = bundleOf({ ...sc, seed: 8 }, "c4", runsFor({ ...sc, seed: 8 }));
    assert.equal(validateRunBundle(wrongSeed, { customId: "c4", labels: ["A", "B"], scenario: sc }), null);
    const plan = replayRunPlan(docOf(sc, simData("c4", { decisionMode: "muse" }), { runBundle: wrongSeed }));
    assert.ok(plan, "card still plans");
    assert.equal(plan.runBundle, null);
    const deps = fakeDeps();
    assert.equal(await restoreReplayRun(plan, deps), false);
    assert.equal(deps.calls.worker, 0);
    const wrongId = bundleOf(sc, "other", runs);
    assert.equal(validateRunBundle(wrongId, { customId: "c4", labels: ["A", "B"], scenario: sc }), null);
  });

  it("strict record with a matching stored record restores it, worker 0 calls", async () => {
    const sc = scenario();
    const plan = replayRunPlan(docOf(sc, simData("c5", {
      provenance: { A: { model: 3, fallback: 0, rule: 1 }, B: { model: 0, fallback: 0, rule: 5 } },
    })));
    assert.equal(plan.requiresStrict, true);
    const stored = { ...bundleOf(sc, "c5", runsFor(sc)), savedAt: "t" };
    const deps = fakeDeps({ stored });
    assert.equal(await restoreReplayRun(plan, deps), true);
    assert.equal(deps.calls.worker, 0);
    assert.equal(deps.calls.saved.length, 0);
  });

  it("stale stored record never merges: strict fails, legacy rebuilds whole", async () => {
    const sc = scenario();
    const stale = bundleOf({ ...sc, seed: 9 }, "c6", runsFor({ ...sc, seed: 9 }));
    const strictPlan = replayRunPlan(docOf(sc, simData("c6", { decisionMode: "muse" })));
    const depsStrict = fakeDeps({ stored: stale });
    assert.equal(await restoreReplayRun(strictPlan, depsStrict), false);
    assert.equal(depsStrict.calls.worker, 0);
    const legacyPlan = replayRunPlan(docOf(sc, simData("c6")));
    const depsLegacy = fakeDeps({ stored: stale, workerRuns: runsFor(sc) });
    assert.equal(await restoreReplayRun(legacyPlan, depsLegacy), true);
    assert.equal(depsLegacy.calls.worker, 1);
    assert.deepEqual(depsLegacy.calls.saved[0].runs, runsFor(sc));
  });

  it("provenance, houseDecisions and confirmed life_plan all require strict", () => {
    const sc = scenario();
    assert.equal(replayRequiresStrict(simData("x"), sc), false);
    assert.equal(replayRequiresStrict(simData("x", {
      houseDecisions: [{ label: "A", items: [{ chosen_by: "rule_fallback" }] }],
    }), sc), true);
    assert.equal(replayRequiresStrict(simData("x"), { ...sc, life_plan: { confirmed: true } }), true);
    assert.equal(replayRequiresStrict(simData("x"), { ...sc, life_plan: { confirmed: false } }), false);
  });

  it("moneyMissing keeps null moneyDoc only with an explicit reason", () => {
    const sc = scenario();
    assert.ok(replayRunPlan(docOf(sc, simData("m1", { moneyDoc: null, moneyMissing: "payroll down" }))), "kept");
    assert.equal(replayRunPlan(docOf(sc, simData("m2", { moneyDoc: null, moneyMissing: "" }))), null);
  });

  it("sub-0.001 coordinate drift is rejected: exact scenario equality, no rounding", () => {
    const sc = { ...scenario(), homes: [{ id: "h", lat: 35.123456, lng: 139.123456 }] };
    const runs = runsFor(sc);
    const exact = bundleOf(sc, "c7", runs);
    assert.ok(validateRunBundle(exact, { customId: "c7", labels: ["A", "B"], scenario: sc }), "exact bundle passes");
    const drifted = bundleOf(sc, "c7", runs);
    drifted.scenario = structuredClone(sc);
    drifted.scenario.homes = [{ id: "h", lat: 35.123956, lng: 139.123456 }];
    assert.equal(validateRunBundle(drifted, { customId: "c7", labels: ["A", "B"], scenario: sc }), null);
  });

  it("helper never throws on data errors", async () => {
    assert.equal(await restoreReplayRun(null, {}), false);
    assert.equal(await restoreReplayRun({ customId: "c", labels: ["A"], scenario: scenario() },
      { loadCustomRun: async () => { throw new Error("db down"); } }), false);
  });
});
