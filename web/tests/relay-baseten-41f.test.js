// Stage 41f: Muse Spark Open runs live in the product (relay side).
// provider:"baseten" without BYOK needs BASETEN_API_KEY on the server,
// counts into its own 150/day global bucket (429 open_limit), shares
// the 41e one-session-per-IP rule across both server keys, and
// /api/model/status reports baseten.hasServerKey as a boolean only.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRelay } from "../../relay/handler.js";
import { SESSION_HEADER } from "../src/chat/session-id.js";

const ORIGIN = "https://halo-sw.github.io";
const KEY = "BASETEN-SERVER-KEY-123";

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
  return () => async (req, res) => {
    seen.calls += 1;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  };
}

function relayWith({ env = {}, now = () => 1000000 } = {}) {
  const seen = { calls: 0 };
  const relay = createRelay({ env, fetchImpl: async () => ({}), now, consultFactory: stubFactory(seen) });
  return { relay, seen };
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

describe("41f baseten on the server key", () => {
  it('provider:"baseten" with BASETEN_API_KEY set reaches the handler', async () => {
    const { relay, seen } = relayWith({ env: { BASETEN_API_KEY: KEY } });
    const res = await callRelay(relay, {
      headers: consultHeaders({ session: "a" }), body: { provider: "baseten" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(seen.calls, 1);
  });

  it("without the key baseten is rejected with 400 provider", async () => {
    const { relay, seen } = relayWith({ env: {} });
    const res = await callRelay(relay, {
      headers: consultHeaders({ session: "a" }), body: { provider: "baseten" },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(bodyText(res)), { ok: false, error: "provider" });
    assert.equal(seen.calls, 0);
  });

  it('provider:"x" is rejected with 400 provider even with the key', async () => {
    const { relay, seen } = relayWith({ env: { BASETEN_API_KEY: KEY } });
    const res = await callRelay(relay, {
      headers: consultHeaders({ session: "a" }), body: { provider: "x" },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(bodyText(res)), { ok: false, error: "provider" });
    assert.equal(seen.calls, 0);
  });

  it("the 151st baseten call in a day is 429 open_limit", async () => {
    const { relay, seen } = relayWith({ env: { BASETEN_API_KEY: KEY } });
    let last;
    for (let i = 0; i < 151; i += 1) {
      last = await callRelay(relay, {
        headers: consultHeaders({ session: "a" }),
        body: { provider: "baseten" },
        ip: `10.7.0.${i + 1}`,
      });
    }
    assert.equal(seen.calls, 150);
    assert.equal(last.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(last)), { ok: false, error: "open_limit" });
  });

  it("one IP: session a on meta then baseten allowed, session b refused", async () => {
    const { relay, seen } = relayWith({ env: { BASETEN_API_KEY: KEY } });
    const first = await callRelay(relay, {
      headers: consultHeaders({ session: "a" }), body: { provider: "meta" },
    });
    assert.equal(first.statusCode, 200);
    const second = await callRelay(relay, {
      headers: consultHeaders({ session: "a" }), body: { provider: "baseten" },
    });
    assert.equal(second.statusCode, 200);
    assert.equal(seen.calls, 2);
    const third = await callRelay(relay, {
      headers: consultHeaders({ session: "b" }), body: { provider: "baseten" },
    });
    assert.equal(third.statusCode, 429);
    assert.deepEqual(JSON.parse(bodyText(third)),
      { ok: false, error: "server_key_used", byok: true });
    assert.equal(seen.calls, 2);
  });

  it("model/status reports baseten.hasServerKey from env, never the key", async () => {
    const { relay } = relayWith({ env: { BASETEN_API_KEY: KEY } });
    const res = await callRelay(relay,
      { method: "GET", url: "/api/model/status", headers: { origin: ORIGIN } });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(bodyText(res));
    assert.equal(body.baseten.hasServerKey, true);
    assert.equal(typeof body.baseten.hasServerKey, "boolean");
    assert.ok(!bodyText(res).includes(KEY));
    const { relay: bare } = relayWith({ env: {} });
    const res2 = await callRelay(bare,
      { method: "GET", url: "/api/model/status", headers: { origin: ORIGIN } });
    assert.equal(JSON.parse(bodyText(res2)).baseten.hasServerKey, false);
    assert.ok(!bodyText(res2).includes(KEY));
  });
});
