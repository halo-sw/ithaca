// Stage 47e: life_plan endpoint + LifePlanCard/LifePlanRunSummary (node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.js";
import { register } from "node:module";
import { providerConfig } from "../src/judge/providers.js";
import { buildLifePlanInput, validateLifePlan, summarizePlanRun, lifePlanExplanation } from "../src/life/plan.js";

register("./jsx-loader.mjs", import.meta.url);

function handlerFor(path) {
  const routes = new Map();
  for (const plugin of config.plugins) {
    if (typeof plugin.configureServer === "function") {
      plugin.configureServer({ middlewares: { use: (p, h) => routes.set(p, h) } });
    }
  }
  return routes.get(path);
}
function mockReq(method, body) {
  const listeners = {};
  return { method, url: "/api/consult", on: (ev, fn) => { listeners[ev] = fn; return null; }, destroy: () => {},
    _emit() { if (body !== null && listeners.data) listeners.data(Buffer.from(body)); if (listeners.end) listeners.end(); } };
}
function mockRes() {
  let resolve; const done = new Promise((r) => { resolve = r; });
  const res = { statusCode: 200, headers: {}, body: "", setHeader: (k, v) => { res.headers[k] = v; }, end: (c) => { res.body += c || ""; resolve(res); } };
  return { res, done };
}
async function post(handler, payload) {
  const req = mockReq("POST", JSON.stringify(payload));
  const { res, done } = mockRes();
  const p = handler(req, res, () => {});
  req._emit(); await p; return done;
}

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
const MESSAGES = [
  { role: "assistant", content: "stale assistant text that must not reach the planner" },
  { role: "user", content: QUOTE },
];

function rawPlan() {
  return {
    members: [
      { id: "h1", changes: [{ field: "preferences", value: "early morning walks and quiet evenings", basis: "stated", evidence: "early morning walks" }] },
      { id: "h2", changes: [{ field: "schooldays", value: ["Mon", "Tue", "Wed", "Thu", "Fri"], basis: "proposal", evidence: "school route check" }] },
    ],
    observations: [{ code: "walks", member_ids: ["h1"], reason: "Morning dog walks repeat on weekdays." }],
    questions: [], unmodeled: [],
  };
}
function planChoice(input) {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(rawPlan()) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 } };
}
function withKey(key, fn) {
  const saved = process.env.MODEL_API_KEY;
  if (key === undefined) delete process.env.MODEL_API_KEY; else process.env.MODEL_API_KEY = key;
  return Promise.resolve().then(fn).finally(() => {
    if (saved === undefined) delete process.env.MODEL_API_KEY; else process.env.MODEL_API_KEY = saved;
  });
}

describe("life_plan endpoint", () => {
  it("dispatches the actual user quote/profile with the configured model", async () => {
    await withKey("test-key", async () => {
      let saw = null;
      const savedFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        saw = { url, body: JSON.parse(opts.body) };
        return { ok: true, status: 200, text: async () => JSON.stringify(planChoice()) };
      };
      try {
        const r = await post(handlerFor("/api/consult"),
          { provider: "meta", task: "life_plan", scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
        assert.equal(r.statusCode, 200);
        const payload = JSON.parse(r.body);
        assert.equal(payload.ok, true);
        assert.ok(payload.plan && Array.isArray(payload.plan.members));
        assert.equal(typeof payload.input_signature, "string");
        assert.equal(payload.usage.provider, "meta");
        assert.equal(payload.usage.model, providerConfig("meta").model);
        assert.equal(saw.body.model, providerConfig("meta").model);
        const sentInput = JSON.parse(saw.body.messages[1].content);
        assert.ok(sentInput.user_texts.some((t) => t.includes("early morning walks")));
        assert.ok(!sentInput.user_texts.some((t) => t.includes("stale assistant")));
        assert.deepEqual(sentInput.profile_values.h1.workdays, PROFILE.h1.workdays.value);
        const expectSig = buildLifePlanInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" }).input_signature;
        assert.equal(payload.input_signature, expectSig);
      } finally { globalThis.fetch = savedFetch; }
    });
  });

  it("needs a server-side key (503, never succeeds)", async () => {
    await withKey(undefined, async () => {
      const r = await post(handlerFor("/api/consult"), { provider: "meta", task: "life_plan", scenario: SCENARIO });
      assert.equal(r.statusCode, 503);
      assert.equal(JSON.parse(r.body).ok, false);
    });
  });

  it("rejects malformed input with 400", async () => {
    await withKey("test-key", async () => {
      const handler = handlerFor("/api/consult");
      const bad = [
        { ...{}, task: "life_plan", provider: "meta" },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, household: { members: [] }, days: 30 } },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, household: { members: Array.from({ length: 9 }, (_, i) => ({ id: `m${i}` })) } } },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, homes: [] } },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, days: 367 } },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, days: 0 } },
        { task: "life_plan", provider: "meta", scenario: { ...SCENARIO, start_date: "2026-13-40" } },
      ];
      for (const b of bad) {
        const r = await post(handler, b);
        assert.equal(r.statusCode, 400, JSON.stringify(b).slice(0, 80));
        assert.equal(JSON.parse(r.body).ok, false);
      }
    });
  });

  it("provider failure is a safe generic 503 with no leak", async () => {
    await withKey("test-key", async () => {
      const savedFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new Error("upstream exploded: secret-boom"); };
      try {
        const r = await post(handlerFor("/api/consult"),
          { provider: "meta", task: "life_plan", scenario: SCENARIO, profile: PROFILE, messages: MESSAGES });
        assert.equal(r.statusCode, 503);
        const payload = JSON.parse(r.body);
        assert.equal(payload.ok, false);
        assert.equal(payload.error, "Life plan could not be prepared. Please retry.");
        assert.ok(!r.body.includes(QUOTE) && !r.body.includes("secret-boom"));
      } finally { globalThis.fetch = savedFetch; }
    });
  });

  it("invalid model JSON cannot succeed", async () => {
    await withKey("test-key", async () => {
      const savedFetch = globalThis.fetch;
      globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(
        { choices: [{ finish_reason: "stop", message: { content: "not json" } } ], usage: {} }) });
      try {
        const r = await post(handlerFor("/api/consult"),
          { provider: "meta", task: "life_plan", scenario: SCENARIO, messages: MESSAGES });
        assert.equal(r.statusCode, 503);
        assert.equal(JSON.parse(r.body).ok, false);
      } finally { globalThis.fetch = savedFetch; }
    });
  });

  it("unrelated tasks are unchanged", async () => {
    await withKey("test-key", async () => {
      const savedFetch = globalThis.fetch;
      globalThis.fetch = async () => ({ ok: true, status: 200,
        text: async () => JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "누구와 사는지 알려주세요" } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) });
      try {
        const r = await post(handlerFor("/api/consult"),
          { provider: "meta", scenario: { name: "tiny", start_date: "2026-11-02", days: 2, seed: 7, background: 0, household: { members: [{ id: "m1" }] }, homes: [{ label: "A" }] }, messages: [{ role: "user", content: "안녕" }] });
        assert.equal(r.statusCode, 200);
        assert.equal(JSON.parse(r.body).reply, "누구와 사는지 알려주세요");
      } finally { globalThis.fetch = savedFetch; }
    });
  });
});

let React; let renderToStaticMarkup; let LifePlanCard; let LifePlanRunSummary;
before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ LifePlanCard, LifePlanRunSummary } = await import("../src/ui/life-plan.jsx"));
});

function fixture() {
  const input = buildLifePlanInput({ scenario: SCENARIO, profile: PROFILE, messages: MESSAGES, lang: "en" });
  const plan = validateLifePlan(rawPlan(), input);
  return { input, plan };
}
function html(el) { return renderToStaticMarkup(React.createElement(el.type, el.props)); }

describe("LifePlanCard", () => {
  it("distinguishes stated/proposal per member, never one persona", async () => {
    const { input, plan } = fixture();
    const out = renderToStaticMarkup(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "en", onConfirm: () => {}, onRevise: () => {} }));
    assert.match(out, /Your month, planned around your life/);
    assert.match(out, /Mina/); assert.match(out, /Jun/);
    assert.match(out, /You stated/); assert.match(out, /Proposed assumption/);
    assert.match(out, /early morning walks and quiet evenings/);
    assert.match(out, /Not confirmed/);
    assert.match(out, /A comparison under your stated assumptions, not a forecast\./);
    assert.match(out, /Plan proposed by Muse/);
    const counts = lifePlanExplanation(plan, SCENARIO, "en").members;
    for (const c of counts) assert.match(out, new RegExp(`${c.work_days} workdays`));
  });

  it("localized school notice and blocked confirm with questions", async () => {
    const { input, plan } = fixture();
    const ko = renderToStaticMarkup(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, lang: "ko", onConfirm: () => {} }));
    assert.match(ko, /생활에 맞춘 한 달 플랜/);
    assert.match(ko, /가정이며, 배정·입학 미확인/);
    const blocked = { ...plan, questions: ["Who walks the dog on weekends?"] };
    const out = renderToStaticMarkup(React.createElement(LifePlanCard, { plan: blocked, input, scenario: SCENARIO, lang: "en", onConfirm: () => {} }));
    assert.match(out, /Who walks the dog on weekends\?/);
    assert.match(out, /disabled/);
  });

  it("error retry and confirmed readonly", async () => {
    const { input, plan } = fixture();
    let retried = 0;
    const errOut = renderToStaticMarkup(React.createElement(LifePlanCard,
      { plan: null, input, scenario: SCENARIO, error: new Error("Life plan could not be prepared. Please retry."), onRetry: () => { retried += 1; } }));
    assert.match(errOut, /Life plan could not be prepared/);
    assert.match(errOut, /Retry/);
    const done = renderToStaticMarkup(React.createElement(LifePlanCard, { plan, input, scenario: SCENARIO, confirmed: true }));
    assert.match(done, /Confirmed/);
    assert.ok(!done.includes("Use this plan and simulate"));
  });
});

describe("LifePlanRunSummary", () => {
  it("shows recorded values only, never invented differences", async () => {
    const { plan } = fixture();
    const run = { total_days: 30,
      agents: [{ id: "h1", household: true }, { id: "h2", household: true }, { id: "bg", household: false }],
      trips: [
        { day: 0, member: "h1", purpose: "commute", minutes: 30 },
        { day: 1, member: "h1", purpose: "errands" },
        { day: 0, member: "bg", purpose: "commute", minutes: 99 },
      ] };
    const summary = summarizePlanRun(run, plan);
    assert.equal(summary.full_period.trips, 2);
    assert.equal(summary.full_period.travel_minutes, 30);
    const out = renderToStaticMarkup(React.createElement(LifePlanRunSummary, { summaries: summary, labels: { h1: "Mina", h2: "Jun" } }));
    assert.match(out, /First 7 days/); assert.match(out, /Full period/);
    assert.match(out, /Recorded travel legs/);
    assert.match(out, /30 min/);
    assert.match(out, /Jun/);
    assert.ok(!out.includes("99"));
    const empty = renderToStaticMarkup(React.createElement(
      LifePlanRunSummary, { summaries: summarizePlanRun({ total_days: 7, trips: [] }, plan) }));
    assert.match(empty, /No recorded trips/);
  });
});
