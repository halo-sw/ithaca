// Stage 47g: plan review -> explicit confirm -> actual run (node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let React;
let renderToStaticMarkup;
let LifePlanCard;
let CardMsg;
let flow;
let planLib;

before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ LifePlanCard } = await import("../src/ui/life-plan.jsx"));
  ({ CardMsg } = await import("../src/ui/chat.jsx"));
  flow = await import("../src/chat/life-plan-flow.js");
  planLib = await import("../src/life/plan.js");
});

const QUOTE = "We need early morning walks with the dog";
const SCENARIO = {
  name: "tiny", start_date: "2026-11-02", days: 30, seed: 7, background: 0,
  household: { members: [
    { id: "h1", label: "Mina", work: { type: "office", place: "Pangyo", station: "Pangyo" }, workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { id: "h2", label: "Jun", schooldays: ["Mon", "Tue", "Wed", "Thu", "Fri"], school: { level: "elementary" } },
  ] },
  homes: [{ label: "A", area: "pangyo", complex_name: "알파" }],
};
const PROFILE = { h1: { workdays: { value: ["Mon", "Tue", "Wed", "Thu", "Fri"], source: "user" } } };
const MESSAGES = [{ role: "user", content: QUOTE }];

function rawPlan() {
  return {
    members: [
      { id: "h1", changes: [{ field: "preferences", value: "early morning walks and quiet evenings", basis: "stated", evidence: "early morning walks" }] },
      { id: "h2", changes: [{ field: "workdays", value: ["Mon", "Tue", "Wed", "Thu"], basis: "proposal", evidence: "school route check" }] },
    ],
    observations: [{ code: "walks", member_ids: ["h1"], reason: "Morning dog walks repeat on weekdays." }],
    questions: [], unmodeled: [],
  };
}

function fakeRuns() {
  const trips = [
    { day: 0, agent: "h1", purpose: "commute", minutes: 30 },
    { day: 1, agent: "h1", purpose: "commute", minutes: 40 },
    { day: 0, agent: "h2", purpose: "school", minutes: 15 },
  ];
  return { A: { total_days: 7, trips } };
}

describe("47g plan review flow (pure, fakes)", () => {
  it("first click calls the planner once and never the worker", async () => {
    let plannerCalls = 0;
    let workerCalls = 0;
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    // The real endpoint answers a NORMALIZED plan (signature/source/
    // confirmed/days) plus usage — never a raw schema-only object.
    const apiPlan = () => planLib.validateLifePlan(rawPlan(), input);
    const { plan, usage } = await flow.requestPlanReview(
      { postPlan: async () => { plannerCalls += 1;
        return { plan: apiPlan(), input_signature: input.input_signature, usage: { provider: "muse" } }; } },
      { input, provider: "muse" });
    assert.equal(plannerCalls, 1);
    assert.equal(workerCalls, 0);
    assert.equal(plan.members.length, 2);
    assert.equal(plan.source, "muse");
    assert.equal(plan.confirmed, false);
    assert.equal(usage.provider, "muse");
  });

  it("rejects forged, foreign-source, raw, and stale plan envelopes", async () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const good = planLib.validateLifePlan(rawPlan(), input);
    const post = (plan, extra = {}) => flow.requestPlanReview(
      { postPlan: async () => ({ plan, input_signature: input.input_signature, ...extra }) },
      { input, provider: "muse" });
    await assert.rejects(post({ ...good, confirmed: true }), /never pre-confirmed/);
    await assert.rejects(post({ ...good, source: "rule" }), /unexpected plan source/);
    await assert.rejects(post(rawPlan()), /unexpected plan source/);
    await assert.rejects(post({ ...good, input_signature: "stale-signature" }), /stale plan/);
    await assert.rejects(post(good, { input_signature: "stale-signature" }), /stale plan/);
    const { plan } = await post(good);
    assert.equal(plan.confirmed, false);
  });

  it("confirmation runs the worker on the applied scenario with changed preferences/workdays", async () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const plan = planLib.validateLifePlan(rawPlan(), input);
    let seenScenario = null;
    const out = await flow.confirmReviewAndRun(
      { runWorker: async (applied, labels) => { seenScenario = applied; assert.deepEqual(labels, ["A"]); return fakeRuns(); } },
      { plan, input, scenario: SCENARIO, labels: ["A"] });
    const members = new Map((out.applied.household.members || []).map((m) => [m.id, m]));
    assert.equal(members.get("h1").preferences, "early morning walks and quiet evenings");
    assert.deepEqual(members.get("h2").workdays, ["Mon", "Tue", "Wed", "Thu"]);
    assert.ok(seenScenario === out.applied);
    // Final payload uses the actual run summary, not invented numbers.
    assert.equal(out.summaries.A.full_period.trips, 3);
    assert.equal(out.summaries.A.full_period.travel_minutes, 85);
    assert.equal(out.summaries.A.first_7_days.trips, 3);
  });

  it("old confirmation and home change do not match a fresh review", () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const snap = (picks, provider) => flow.reviewSnapshot({ profileText: "p", pickedIds: picks, provider, messages: MESSAGES });
    const stored = [{ kind: "life_plan", id: "r1",
      data: { status: "review", plan: rawPlan(), input, provider: "muse", snapshot: snap(["a", "b"], "muse") } }];
    assert.equal(flow.findFreshReview(stored,
      { inputSignature: input.input_signature, provider: "muse", snapshot: snap(["a", "b"], "muse") }).id, "r1");
    // Home change blocks reuse.
    assert.equal(flow.findFreshReview(stored,
      { inputSignature: input.input_signature, provider: "muse", snapshot: snap(["a", "c"], "muse") }), null);
    // Provider change invalidates.
    assert.equal(flow.findFreshReview(stored,
      { inputSignature: "other-signature", provider: "other", snapshot: snap(["a", "b"], "other") }), null);
    assert.equal(flow.findFreshReview(stored,
      { inputSignature: input.input_signature, provider: "other", snapshot: snap(["a", "b"], "other") }), null);
  });

  it("model throw / malformed plan never runs", async () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    let workerCalls = 0;
    const runWorker = async () => { workerCalls += 1; return fakeRuns(); };
    await assert.rejects(flow.requestPlanReview(
      { postPlan: async () => { throw new Error("provider down"); } }, { input, provider: "muse" }));
    assert.equal(workerCalls, 0);
    assert.throws(() => flow.buildReviewInput
      ? planLib.validateLifePlan({ members: [], observations: [], questions: [], unmodeled: [] }, input)
      : null, /plan must cover every input member/);
    assert.equal(workerCalls, 0);
  });

  it("unresolved questions block confirmation; busy duplicates are refused", async () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const blocked = planLib.validateLifePlan({ ...rawPlan(), questions: ["What time does Jun start school?"] }, input);
    let workerCalls = 0;
    await assert.rejects(flow.confirmReviewAndRun(
      { runWorker: async () => { workerCalls += 1; return fakeRuns(); } },
      { plan: blocked, input, scenario: SCENARIO, labels: ["A"] }), /unresolved questions/);
    assert.equal(workerCalls, 0);
    const guard = flow.createPlanGuard();
    assert.equal(guard.tryAcquire(), true);
    assert.equal(guard.tryAcquire(), false);
    guard.release();
    assert.equal(guard.tryAcquire(), true);
  });

  it("SSR review message renders the card and confirm wiring", () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const plan = planLib.validateLifePlan(rawPlan(), input);
    const html = renderToStaticMarkup(React.createElement(LifePlanCard,
      { plan, input, scenario: SCENARIO, lang: "en", onConfirm: () => {}, onRevise: () => {}, onRetry: () => {} }));
    assert.match(html, /data-testid="life-plan-confirm"/);
    const msg = { id: "r9", kind: "life_plan", role: "assistant",
      data: { status: "review", plan, input, baseScenario: SCENARIO, pickedIds: ["a"], provider: "muse" } };
    const handlers = { onPlanConfirm: () => {}, onPlanRevise: () => {}, onPlanRetry: () => {}, picks: [] };
    const card = renderToStaticMarkup(React.createElement(CardMsg, { msg, handlers, toolRows: {}, cardHi: null }));
    assert.match(card, /data-testid="life-plan-confirm"/);
  });

  it("47l transaction used by Chat: freshness + single-use confirmed payload", async () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const plan = planLib.validateLifePlan(rawPlan(), input);
    const snapAB = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "b"], provider: "muse", messages: MESSAGES });
    const stored = { plan, input, provider: "muse", snapshot: snapAB };
    // Current AB conditions confirm fresh.
    assert.equal(flow.isConfirmFresh({ stored, input, snapshot: snapAB, provider: "muse" }).fresh, true);
    // AB review after the user changed to AC is stale — never runs AB.
    const snapAC = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "c"], provider: "muse", messages: MESSAGES });
    assert.equal(flow.isConfirmFresh({ stored, input, snapshot: snapAC, provider: "muse" }).fresh, false);
    // Changed provider / profile / user content after the awaited load blocks.
    assert.equal(flow.isConfirmFresh({ stored, input, snapshot: snapAB, provider: "other" }).fresh, false);
    const snapProfile = flow.reviewSnapshot({ profileText: "changed", pickedIds: ["a", "b"], provider: "muse", messages: MESSAGES });
    assert.equal(flow.isConfirmFresh({ stored, input, snapshot: snapProfile, provider: "muse" }).fresh, false);
    const moreUser = [...MESSAGES, { role: "user", content: "actually evenings" }];
    const snapUser = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "b"], provider: "muse", messages: moreUser });
    assert.equal(flow.isConfirmFresh({ stored, input, snapshot: snapUser, provider: "muse" }).fresh, false);
    const input2 = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: moreUser, lang: "en" });
    assert.equal(flow.isConfirmFresh({ stored, input: input2, snapshot: snapAB, provider: "muse" }).fresh, false);
    // Transaction: double stage refused, consume is single-use, failed
    // preparation leaves no pending confirmed payload.
    const txn = flow.createConfirmedTransaction();
    assert.equal(txn.pending, null);
    assert.equal(txn.stage({ plan: "p1" }), true);
    assert.equal(txn.stage({ plan: "p2" }), false);
    assert.deepEqual(txn.consume(), { plan: "p1" });
    assert.equal(txn.pending, null);
    assert.equal(txn.consume(), null);
    // Guard: double plan/run start refused while one is in flight.
    const guard = flow.createPlanGuard();
    assert.equal(guard.tryAcquire(), true);
    assert.equal(guard.tryAcquire(), false);
    guard.release();
    assert.equal(guard.tryAcquire(), true);
    guard.release();
  });

  it("47l2 confirmed worker freshness uses the review payload, never applied signature", () => {
    const input = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
    const plan = planLib.validateLifePlan(rawPlan(), input);
    const confirmed = planLib.confirmLifePlan(plan, input);
    const applied = planLib.applyLifePlan(SCENARIO, confirmed, input);
    assert.equal((applied.household.members || []).length, 2);
    const snapshot = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "b"], provider: "muse", messages: MESSAGES });
    const extras = { plan: confirmed, applied, ids: ["a", "b"], input, snapshot, provider: "muse" };
    assert.equal(flow.isConfirmedWorkerFresh({ extras, input, snapshot, provider: "muse" }), true);
    assert.equal(flow.isConfirmedWorkerFresh({ extras, input, snapshot, provider: "other" }), false);
    const snapProfile = flow.reviewSnapshot({ profileText: "changed", pickedIds: ["a", "b"], provider: "muse", messages: MESSAGES });
    assert.equal(flow.isConfirmedWorkerFresh({ extras, input, snapshot: snapProfile, provider: "muse" }), false);
    const snapAC = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "c"], provider: "muse", messages: MESSAGES });
    assert.equal(flow.isConfirmedWorkerFresh({ extras, input, snapshot: snapAC, provider: "muse" }), false);
    const moreUser = [...MESSAGES, { role: "user", content: "actually evenings" }];
    const input2 = flow.buildReviewInput({ scenario: SCENARIO, profile: PROFILE, messages: moreUser, lang: "en" });
    const snapUser = flow.reviewSnapshot({ profileText: "p", pickedIds: ["a", "b"], provider: "muse", messages: moreUser });
    assert.equal(flow.isConfirmedWorkerFresh({ extras, input: input2, snapshot: snapUser, provider: "muse" }), false);
    assert.equal(flow.isConfirmedWorkerFresh({ extras: null, input, snapshot, provider: "muse" }), false);
  });
});
