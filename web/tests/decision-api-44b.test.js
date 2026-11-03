import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConsultHandler } from "../src/consult/server.js";
import { createRelay } from "../../relay/handler.js";
import { SESSION_HEADER } from "../src/chat/session-id.js";

const ORIGIN = "https://halo-sw.github.io";
const OWN_KEY = "own-test-key";
const SERVER_KEY = "server-test-key";

function shell() {
  return {
    id: "h1:d0:600:shop_choice:00", agent: "h1", day: 0, minute: 600,
    kind: "shop_choice", default_key: "s0",
    options: [
      { key: "s0", minutes: 3.2, distance_m: 250 },
      { key: "s1", minutes: 5.1, distance_m: 400 },
    ],
  };
}

function context() {
  return {
    member: { id: "m1", role: "adult", preferences: "" },
    agentLabel: "You", date: "2026-11-02", weekday: "Mon",
    memory: [], tripsToday: [], shell: shell(),
  };
}

function decisionBody(over = {}) {
  return { task: "decision", provider: "meta", context: context(), ...over };
}

function mockReq(body, headers = {}) {
  return { method: "POST", headers, body };
}

function mockRes() {
  const res = {
    statusCode: 200, headers: {}, body: "",
    setHeader(k, v) { res.headers[String(k).toLowerCase()] = v; },
    end(chunk) { if (chunk !== undefined) res.body += String(chunk); },
  };
  return res;
}

function providerOk(chosen, usage = { prompt_tokens: 100, completion_tokens: 20 }) {
  return {
    ok: true, status: 200,
    text: async () => JSON.stringify({
      choices: [{ message: { content: JSON.stringify(chosen) } }],
      usage,
    }),
  };
}

function makeHandler(fetchImpl) {
  return createConsultHandler({
    env: { META_API_KEY: SERVER_KEY },
    fetchImpl,
    readText: () => { throw new Error("should not load files for decision"); },
  });
}

describe("decision api 44b", () => {
  it("uses the BYOK key and never leaks either key", async () => {
    let seenAuth = null;
    let calls = 0;
    const handler = makeHandler(async (url, opts) => {
      calls++;
      seenAuth = opts && opts.headers && opts.headers.Authorization;
      return providerOk({ chosen_key: "s1", reason_ko: "걷고 싶어서", reason_en: "A longer walk fits this routine" });
    });
    const req = mockReq(decisionBody(), { "x-model-key": OWN_KEY });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(String(seenAuth).includes(OWN_KEY), `Authorization uses own key, got ${seenAuth}`);
    assert.ok(!String(seenAuth).includes(SERVER_KEY));
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.entry.chosen_key, "s1");
    assert.ok(!res.body.includes(OWN_KEY) && !res.body.includes(SERVER_KEY));
    assert.equal(calls, 1);
  });

  it("invalid choice becomes an explicit guarded fallback", async () => {
    const handler = makeHandler(async () => providerOk({ chosen_key: "s9", reason_ko: "x", reason_en: "y" }));
    const res = mockRes();
    await handler(mockReq(decisionBody(), { "x-model-key": OWN_KEY }), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.entry.chosen_by, "rule_fallback");
    assert.equal(body.entry.chosen_key, "s0");
  });

  it("malformed shell is 400 with zero provider calls", async () => {
    let calls = 0;
    const handler = makeHandler(async () => { calls++; return providerOk({ chosen_key: "s1" }); });
    const bad = decisionBody();
    bad.context.shell.kind = "nap";
    const res = mockRes();
    await handler(mockReq(bad, { "x-model-key": OWN_KEY }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls, 0);
  });

  it("provider 401 with key text is a generic 503 with no echoed key", async () => {
    const handler = makeHandler(async () => ({
      ok: false, status: 401,
      text: async () => `unauthorized for key ${OWN_KEY}`,
    }));
    const res = mockRes();
    await handler(mockReq(decisionBody(), { "x-model-key": OWN_KEY }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(!res.body.includes(OWN_KEY) && !res.body.includes(SERVER_KEY));
    assert.ok(!res.body.includes('"ok":true'));
  });
});

function relayReq({ ip, session, body, judge = null }) {
  const headers = { origin: ORIGIN, "x-forwarded-for": ip, [SESSION_HEADER]: session };
  if (judge) headers["x-ithaca-judge"] = judge;
  return { method: "POST", url: "/api/consult", headers, body };
}

async function relayCall(relay, opts) {
  const res = mockRes();
  await relay(relayReq(opts), res);
  return res;
}

const decision = { task: "decision", provider: "meta" };
const chat = { provider: "meta" };

describe("decision relay 44b", () => {
  it("21 decisions pass; chats keep their own 20/10m quota", async () => {
    let clock = 1000000;
    const relay = createRelay({
      env: { META_API_KEY: "fake" }, now: () => clock,
      consultFactory: () => async (req, res) => res.end(JSON.stringify({ ok: true })),
    });
    for (let i = 0; i < 21; i++) {
      const r = await relayCall(relay, { ip: "10.9.0.1", session: "sess-a", body: decision });
      assert.equal(r.statusCode, 200, `decision ${i}`);
    }
    for (let i = 0; i < 20; i++) {
      const r = await relayCall(relay, { ip: "10.9.0.1", session: "sess-a", body: chat });
      assert.equal(r.statusCode, 200, `chat ${i}`);
    }
    const over = await relayCall(relay, { ip: "10.9.0.1", session: "sess-a", body: chat });
    assert.equal(over.statusCode, 429);
  });

  it("121st decision in 10m blocked; window slides after 601000ms", async () => {
    let clock = 2000000;
    const relay = createRelay({
      env: { META_API_KEY: "fake" }, now: () => clock,
      consultFactory: () => async (req, res) => res.end(JSON.stringify({ ok: true })),
    });
    for (let i = 0; i < 120; i++) {
      const r = await relayCall(relay, { ip: "10.9.0.2", session: "sess-d", body: decision });
      assert.equal(r.statusCode, 200, `decision ${i}`);
    }
    assert.equal((await relayCall(relay, { ip: "10.9.0.2", session: "sess-d", body: decision })).statusCode, 429);
    clock += 601000;
    assert.equal((await relayCall(relay, { ip: "10.9.0.2", session: "sess-d", body: decision })).statusCode, 200);
  });

  it("a second server-key session on the same IP is rejected", async () => {
    let clock = 3000000;
    const relay = createRelay({
      env: { META_API_KEY: "fake" }, now: () => clock,
      consultFactory: () => async (req, res) => res.end(JSON.stringify({ ok: true })),
    });
    assert.equal((await relayCall(relay, { ip: "10.9.0.4", session: "sess-one", body: decision })).statusCode, 200);
    const r = await relayCall(relay, { ip: "10.9.0.4", session: "sess-two", body: decision });
    assert.equal(r.statusCode, 429);
    assert.ok(r.body.includes("server_key_used"));
  });

  it("judge codes skip the IP window; 1501st decision of the day blocked", async () => {
    let clock = 4000000;
    const code = "test-judge-code-123";
    const relay = createRelay({
      env: { META_API_KEY: "fake", JUDGE_CODES: code }, now: () => clock,
      consultFactory: () => async (req, res) => res.end(JSON.stringify({ ok: true })),
    });
    const ip = "10.9.0.5";
    assert.equal((await relayCall(relay, { ip, session: "judge-s1", body: decision, judge: code })).statusCode, 200);
    assert.equal((await relayCall(relay, { ip, session: "judge-s2", body: decision, judge: code })).statusCode, 200);
    let done = 2;
    for (const group of [499, 499, 500]) {
      for (let i = 0; i < group; i++) {
        const r = await relayCall(relay, { ip, session: "judge-s1", body: decision, judge: code });
        assert.equal(r.statusCode, 200, `judge decision ${done}`);
        done++;
      }
      clock += 601000;
    }
    assert.equal(done, 1500);
    assert.equal((await relayCall(relay, { ip, session: "judge-s1", body: decision, judge: code })).statusCode, 429);
  });

  it("malformed JSON is not a decision: passes through without spending it", async () => {
    let clock = 5000000;
    const relay = createRelay({
      env: { META_API_KEY: "fake" }, now: () => clock,
      consultFactory: () => async (req, res) => res.end(JSON.stringify({ ok: true })),
    });
    const res = mockRes();
    await relay(relayReq({ ip: "10.9.0.6", session: "sess-m", body: "{oops" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).ok, true);
  });
});
