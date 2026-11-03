// 49h: armed routine revision goes directly to a NEW plan (node --test).
// This harness executes the REAL send() source from web/src/ui/chat.jsx
// (extracted between `async function send` and `function chipAction`)
// in a vm context with stubbed dependencies. No copied send equivalent.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRevisionIntent, shouldTakeRevision,
  withRevisionMessage } from "../src/chat/routine-revision.js";
import { buildReviewInput } from "../src/chat/life-plan-flow.js";

const QUOTE = "Errands Thursday daytime, work remote Friday mornings";
const SCENARIO = {
  name: "tiny", start_date: "2026-11-02", days: 30, seed: 7, background: 0,
  household: { members: [
    { id: "h1", label: "Mina", work: { type: "office", place: "Pangyo", station: "Pangyo" }, workdays: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  ] },
  homes: [{ label: "A", area: "pangyo", complex_name: "알파" }],
};
const PROFILE = { h1: { workdays: { value: ["Mon", "Tue", "Wed", "Thu", "Fri"], source: "user" } } };

let cachedSendSrc = null;
function getRealSendSrc() {
  if (cachedSendSrc) return cachedSendSrc;
  const src = fs.readFileSync(new URL("../src/ui/chat.jsx", import.meta.url), "utf8");
  const start = src.indexOf("  async function send(text) {");
  assert.notEqual(start, -1, "send start not found");
  const end = src.indexOf("  function chipAction(chip) {", start);
  assert.notEqual(end, -1, "chipAction end not found");
  cachedSendSrc = src.slice(start, end);
  assert.match(cachedSendSrc, /shouldTakeRevision/);
  assert.doesNotMatch(cachedSendSrc, /<[A-Za-z]/);
  return cachedSendSrc;
}

// Build a vm sandbox with every free variable send() touches, then run
// the real source and return the live async send function.
function createRealSend({ messages, picks, profile, lang = "ko",
  busy = false, planBusy = false, replay = false } = {}) {
  const intent = createRevisionIntent();
  intent.arm();
  const state = {
    picks: picks ?? ["a", "b"],
    candidatesData: { result: { candidates: [{ id: "a" }, { id: "b" }, { id: "c" }] } },
    profile: profile === undefined ? { ...PROFILE } : profile,
    messages: messages ?? [{ role: "user", content: "base routine" }],
  };
  const calls = { plan: 0, agent: 0, worker: 0, lastPlan: null };
  const pushed = [];
  let uidSeq = 0;
  const sandbox = {
    busyRef: { current: busy },
    planGuardRef: { current: planBusy ? { busy: true } : null },
    replayId: replay ? "r1" : null,
    replaying: replay ? true : false,
    shouldTakeRevision,
    reviseIntentRef: { current: intent },
    setBusy() {}, setError() {}, setNoAnswerSaved() {},
    setChipsNearBottom() {}, setComposer() {},
    pushMsg(msg) {
      uidSeq += 1;
      const id = `u${uidSeq}`;
      pushed.push({ id, ...msg });
      return id;
    },
    stateRef: { current: state },
    withRevisionMessage,
    museLive: true, noticeKeylessOnce() {},
    runGate: () => ({ ok: true }),
    readinessNote: () => null,
    displayNameFor: (c) => String((c && c.id) || ""),
    providerRef: { current: "mock-provider" },
    loadByoKey: () => "",
    requestPlanFlow: async (args) => { calls.plan += 1; calls.lastPlan = args; },
    routeTurn: () => "agent",
    shouldCallMuse: () => false,
    museFails: false,
    askAgent: async () => { calls.agent += 1; },
    structuredFlow: async () => { calls.worker += 1; },
    store: { set() {} },
    US_NO_JEONSE_SUPPORT: "no-jeonse",
    currentLang: () => lang,
    nonMuseNoReplyLine: () => "fallback",
    answeredSince: () => true,
    replyCountRef: { current: 0 },
  };
  vm.createContext(sandbox);
  const send = vm.runInContext(`${getRealSendSrc()}\n send;`, sandbox);
  assert.equal(typeof send, "function");
  return { send, calls, pushed, state, intent, sandbox };
}

describe("49h routine revision transaction (real send)", () => {
  it("armed send syncs the exact quote and plans with forcePlan, then ordinary send calls askAgent", async () => {
    const h = createRealSend({ messages: [{ role: "user", content: "base routine" }], lang: "en" });
    const sigBefore = buildReviewInput({ scenario: SCENARIO, profile: PROFILE,
      messages: h.state.messages, lang: "en" }).input_signature;
    await h.send(QUOTE);
    assert.equal(h.intent.peek(), false);
    assert.equal(h.calls.plan, 1);
    assert.equal(h.calls.agent, 0);
    assert.equal(h.calls.worker, 0);
    const live = () => h.sandbox.stateRef.current.messages;
    const contents = live().map((m) => m.content);
    assert.ok(contents.includes(QUOTE), "fresh user message present in stateRef");
    const sigAfter = buildReviewInput({ scenario: SCENARIO, profile: PROFILE,
      messages: live(), lang: "en" }).input_signature;
    assert.notEqual(sigAfter, sigBefore);
    assert.equal(h.calls.lastPlan.forcePlan, true);
    assert.deepEqual([...h.calls.lastPlan.ids], ["a", "b"]);
    assert.equal(h.calls.lastPlan.picked.length, 2);
    assert.equal(h.calls.lastPlan.providerInUse, "mock-provider");
    await h.send("another question");
    assert.equal(h.calls.plan, 1);
    assert.equal(h.calls.agent, 1);
  });

  it("blocked busy, plan busy and replay sends leave intent and messages untouched", async () => {
    for (const opts of [{ busy: true }, { planBusy: true }, { replay: true }]) {
      const h = createRealSend({ messages: [{ role: "user", content: "base" }], ...opts });
      await h.send(QUOTE);
      assert.equal(h.intent.peek(), true, JSON.stringify(opts));
      assert.equal(h.state.messages.length, 1);
      assert.equal(h.pushed.length, 0);
      assert.equal(h.calls.plan, 0);
      assert.equal(h.calls.agent, 0);
      assert.equal(h.calls.worker, 0);
      await h.send("   ");
      assert.equal(h.intent.peek(), true);
      assert.equal(h.calls.plan, 0);
    }
  });

  it("insufficient picks appends guidance instead of a silent drop", async () => {
    const h = createRealSend({ picks: ["a"], lang: "ko" });
    await h.send(QUOTE);
    assert.equal(h.calls.plan, 0);
    assert.equal(h.calls.agent, 0);
    assert.ok(h.sandbox.stateRef.current.messages.map((m) => m.content).includes(QUOTE));
    const last = h.pushed[h.pushed.length - 1];
    assert.equal(last.role, "assistant");
    assert.match(String(last.content), /두/);
  });

  it("withRevisionMessage never duplicates an already-present id", () => {
    const msg = { id: "u9", role: "user", kind: "text", content: QUOTE };
    const once = withRevisionMessage([], msg);
    assert.equal(once.length, 1);
    assert.equal(withRevisionMessage(once, msg).length, 1);
  });
});
