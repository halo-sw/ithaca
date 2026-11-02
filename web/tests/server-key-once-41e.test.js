// Stage 41e: the relay's server key serves one chat session per IP,
// then the visitor switches to their own key. Driven through the
// handler like relay-23a.test.js: fetch, req and res are faked.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRelay } from "../../relay/handler.js";
import { SESSION_HEADER } from "../src/chat/session-id.js";

const ORIGIN = "https://halo-sw.github.io";

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
  return Buffer.concat(res.chunks).toString("utf8");
}

function stubFactory(seen) {
  return (opts) => {
    seen.opts = opts;
    return async (req, res) => {
      seen.calls += 1;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    };
  };
}

function relayWith({ env = {}, now = () => 1000000, seen = null } = {}) {
  const store = seen || { calls: 0, opts: null };
  const relay = createRelay({ env, fetchImpl: async () => ({}), now, consultFactory: stubFactory(store) });
  return { relay, seen: store };
}

async function callRelay(relay, { method = "POST", url = "/api/consult", headers = {}, body = undefined, ip = "1.1.1.1" }) {
  const { res, done } = mockRes();
  const req = { method, url, headers, socket: { remoteAddress: ip } };
  if (body !== undefined) req.body = body;
  await relay(req, res);
  return await done;
}

function consultHeaders({ session, byok } = {}) {
  const headers = { origin: ORIGIN };
  if (session !== undefined) headers[SESSION_HEADER] = session;
  if (byok) headers["x-model-key"] = byok;
  return headers;
}

describe("41e one server-key session per IP", () => {
  it("session a twice allowed, session b refused, another IP allowed", async () => {
    const { relay, seen } = relayWith();
    const first = await callRelay(relay,
      { headers: consultHeaders({ session: "a" }), body: {} });
    assert.equal(first.statusCode, 200);
    const second = await callRelay(relay,
      { headers: consultHeaders({ session: "a" }), body: {} });
    assert.equal(second.statusCode, 200);
    assert.equal(seen.calls, 2);
    const other = await callRelay(relay,
      { headers: consultHeaders({ session: "b" }), body: {} });
    assert.equal(other.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(other)),
      { ok: false, error: "server_key_used", byok: true });
    assert.equal(seen.calls, 2);
    const foreign = await callRelay(relay,
      { headers: consultHeaders({ session: "c" }), body: {}, ip: "2.2.2.2" });
    assert.equal(foreign.statusCode, 200);
    assert.equal(seen.calls, 3);
  });

  it("a BYOK request skips the rule even on a spent IP", async () => {
    const { relay, seen } = relayWith();
    const first = await callRelay(relay,
      { headers: consultHeaders({ session: "a" }), body: {} });
    assert.equal(first.statusCode, 200);
    const byok = await callRelay(relay,
      { headers: consultHeaders({ session: "b", byok: "VISITOR-KEY" }), body: {} });
    assert.equal(byok.statusCode, 200);
    assert.equal(seen.calls, 2);
  });

  it("a missing session id is refused once the IP used one", async () => {
    const { relay, seen } = relayWith();
    const nakedFirst = await callRelay(relay,
      { headers: { origin: ORIGIN }, body: {} });
    assert.equal(nakedFirst.statusCode, 200);
    const named = await callRelay(relay,
      { headers: consultHeaders({ session: "a" }), body: {} });
    assert.equal(named.statusCode, 200);
    assert.equal(seen.calls, 2);
    const nakedSecond = await callRelay(relay,
      { headers: { origin: ORIGIN }, body: {} });
    assert.equal(nakedSecond.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(nakedSecond)),
      { ok: false, error: "server_key_used", byok: true });
    assert.equal(seen.calls, 2);
  });

  it("the remembered session expires after 24 h", async () => {
    let t = 1000000;
    const { relay, seen } = relayWith({ now: () => t });
    const first = await callRelay(relay,
      { headers: consultHeaders({ session: "a" }), body: {} });
    assert.equal(first.statusCode, 200);
    t += 86400000 + 1;
    const next = await callRelay(relay,
      { headers: consultHeaders({ session: "b" }), body: {} });
    assert.equal(next.statusCode, 200);
    assert.equal(seen.calls, 2);
  });

  it("CORS preflight allows x-ithaca-session", async () => {
    const { relay } = relayWith();
    const res = await callRelay(relay,
      { method: "OPTIONS", url: "/api/consult", headers: { origin: ORIGIN } });
    assert.equal(res.statusCode, 204);
    assert.ok(String(res.headers["access-control-allow-headers"]).includes("x-ithaca-session"));
    assert.ok(String(res.headers["access-control-allow-headers"]).includes("x-model-key"));
  });
});
