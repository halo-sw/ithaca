// Stage 43a: judges are never blocked by the one-session-per-IP rule.
// A shared judge code skips the session rule and the per-IP buckets;
// everyone else gets more sessions per IP via SESSIONS_PER_IP.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRelay } from "../../relay/handler.js";
import { createSessionStore } from "../../relay/session-store.js";
import { SESSION_HEADER } from "../src/chat/session-id.js";
import { captureJudgeCode, judgeHeaders } from "../src/chat/judge-code.js";

const ORIGIN = "https://halo-sw.github.io";
const CODE = "abcdefghijkl";
const JUDGE_HEADER = "x-ithaca-judge";

function mockRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    setHeader(k, v) { res.headers[String(k).toLowerCase()] = v; },
    end(chunk) {
      if (chunk !== undefined) res.chunks.push(Buffer.from(chunk));
      resolve(res);
    },
  };
  return { res, done };
}

function bodyText(res) {
  return res.chunks.length ? Buffer.concat(res.chunks).toString("utf8") : "";
}

function stubFactory(seen) {
  return () => async (req, res) => {
    seen.calls += 1;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  };
}

function relayWith({ env = {}, now = () => 1000000, sessionStore } = {}) {
  const seen = { calls: 0 };
  const relay = createRelay({
    env, fetchImpl: async () => ({}), now, consultFactory: stubFactory(seen), sessionStore,
  });
  return { relay, seen };
}

async function callRelay(relay, { method = "POST", url = "/api/consult", headers = {}, body = undefined, ip = "1.1.1.1" }) {
  const { res, done } = mockRes();
  const req = { method, url, headers, socket: { remoteAddress: ip } };
  if (body !== undefined) req.body = body;
  await relay(req, res);
  return await done;
}

const headersFor = (session, judge) => {
  const h = { origin: ORIGIN, [SESSION_HEADER]: session };
  if (judge !== undefined) h[JUDGE_HEADER] = judge;
  return h;
};

describe("43a judge code bypasses the session rule and per-IP buckets", () => {
  it("session a allowed; b with the code allowed; c with a wrong code refused; short env codes ignored", async () => {
    const { relay, seen } = relayWith({ env: { JUDGE_CODES: "abc, abcdefghijkl " } });
    const bodies = [];
    const first = await callRelay(relay, { headers: headersFor("a"), body: {} });
    assert.equal(first.statusCode, 200);
    bodies.push(bodyText(first));
    const judge = await callRelay(relay, { headers: headersFor("b", CODE), body: {} });
    assert.equal(judge.statusCode, 200);
    bodies.push(bodyText(judge));
    assert.equal(seen.calls, 2);
    const wrong = await callRelay(relay, { headers: headersFor("c", "wrongcode123"), body: {} });
    assert.equal(wrong.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(wrong)),
      { ok: false, error: "server_key_used", byok: true });
    const short = await callRelay(relay, { headers: headersFor("d", "abc"), body: {} });
    assert.equal(short.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(short)),
      { ok: false, error: "server_key_used", byok: true });
    assert.equal(seen.calls, 2);
    for (const b of [...bodies, bodyText(wrong), bodyText(short)]) {
      assert.ok(!b.includes(CODE), "response body must not contain the code");
    }
  });

  it("25 judged consult calls in 10 min from one IP are not limited by consult10", async () => {
    const { relay, seen } = relayWith({ env: { JUDGE_CODES: CODE } });
    for (let i = 0; i < 25; i++) {
      const res = await callRelay(relay,
        { headers: headersFor(`judge-session-${i}`, CODE), body: {} });
      assert.equal(res.statusCode, 200);
    }
    assert.equal(seen.calls, 25);
  });

  it("SESSIONS_PER_IP=3 allows a, b, c but refuses d", async () => {
    const { relay, seen } = relayWith({ env: { SESSIONS_PER_IP: "3" } });
    for (const s of ["a", "b", "c"]) {
      const res = await callRelay(relay, { headers: headersFor(s), body: {} });
      assert.equal(res.statusCode, 200);
    }
    const fourth = await callRelay(relay, { headers: headersFor("d"), body: {} });
    assert.equal(fourth.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(fourth)),
      { ok: false, error: "server_key_used", byok: true });
    assert.equal(seen.calls, 3);
  });

  it("an old-format stored { session } still allows that session", async () => {
    const backing = new Map([["srv-session:1.1.1.1", { session: "a", t: 1000000 }]]);
    const cache = {
      async get(key) { return backing.has(key) ? backing.get(key) : null; },
      async set(key, value) { backing.set(key, value); },
    };
    const { relay, seen } = relayWith({ sessionStore: createSessionStore({ cache }) });
    const same = await callRelay(relay, { headers: headersFor("a"), body: {} });
    assert.equal(same.statusCode, 200);
    assert.equal(seen.calls, 1);
  });

  it("SESSIONS_PER_IP=99 behaves as 10", async () => {
    const { relay, seen } = relayWith({ env: { SESSIONS_PER_IP: "99" } });
    for (let i = 0; i < 10; i++) {
      const res = await callRelay(relay, { headers: headersFor(`s${i}`), body: {} });
      assert.equal(res.statusCode, 200);
    }
    const extra = await callRelay(relay, { headers: headersFor("s10"), body: {} });
    assert.equal(extra.statusCode, 429);
    assert.equal(seen.calls, 10);
  });

  it("OPTIONS lists x-ithaca-judge and no response header carries the code", async () => {
    const { relay } = relayWith({ env: { JUDGE_CODES: CODE } });
    const pre = await callRelay(relay,
      { method: "OPTIONS", url: "/api/consult", headers: { origin: ORIGIN } });
    assert.equal(pre.statusCode, 204);
    assert.ok(String(pre.headers["access-control-allow-headers"]).includes("x-ithaca-judge"));
    const res = await callRelay(relay, { headers: headersFor("z", CODE), body: {} });
    assert.equal(res.statusCode, 200);
    for (const v of Object.values(res.headers)) {
      assert.ok(!String(v).includes(CODE), "response header must not contain the code");
    }
    assert.ok(!bodyText(res).includes(CODE));
  });

  it("captureJudgeCode stores the code and keeps lang while dropping judge", async () => {
    const store = new Map();
    let replaced = null;
    globalThis.location = {
      search: `?judge=${CODE}&lang=en`,
      hash: "",
      pathname: "/ithaca/",
    };
    globalThis.history = { replaceState(a, b, url) { replaced = url; } };
    globalThis.sessionStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, v); },
    };
    try {
      captureJudgeCode();
      assert.equal(store.get("ithaca.judge"), CODE);
      assert.ok(replaced.includes("lang=en"));
      assert.ok(!replaced.includes("judge"));
      assert.deepEqual(judgeHeaders(), { [JUDGE_HEADER]: CODE });
    } finally {
      delete globalThis.location;
      delete globalThis.history;
      delete globalThis.sessionStorage;
    }
  });
});
