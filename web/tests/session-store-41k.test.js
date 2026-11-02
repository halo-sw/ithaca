// Stage 41k: the one-session-per-IP rule holds across relay instances.
// Two relays share one (fake) cache: the second session from the same
// IP is refused even though it lands on another instance.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRelay } from "../../relay/handler.js";
import { createSessionStore } from "../../relay/session-store.js";
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

function stubFactory(seen) {
  return () => async (req, res) => {
    seen.calls += 1;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  };
}

function fakeCache(backing = new Map()) {
  return {
    backing,
    async get(key) { return backing.has(key) ? backing.get(key) : null; },
    async set(key, value, opts) { backing.set(key, value); },
  };
}

function relayWithStore(sessionStore, seen = { calls: 0 }) {
  const relay = createRelay({
    env: {},
    fetchImpl: async () => ({}),
    now: () => 1000000,
    consultFactory: stubFactory(seen),
    sessionStore,
  });
  return { relay, seen };
}

async function callRelay(relay, { headers = {}, body = undefined, ip = "1.1.1.1" }) {
  const { res, done } = mockRes();
  const req = { method: "POST", url: "/api/consult", headers, socket: { remoteAddress: ip } };
  if (body !== undefined) req.body = body;
  await relay(req, res);
  return await done;
}

const headersFor = (session) => ({ origin: ORIGIN, [SESSION_HEADER]: session });

describe("41k one server-key session per IP across instances", () => {
  it("same cache: session a on instance 1 allowed, b on instance 2 refused, a on instance 2 allowed", async () => {
    const cache = fakeCache();
    const r1 = relayWithStore(createSessionStore({ cache }));
    const r2 = relayWithStore(createSessionStore({ cache }));

    const first = await callRelay(r1.relay, { headers: headersFor("a"), body: {} });
    assert.equal(first.statusCode, 200);

    const other = await callRelay(r2.relay, { headers: headersFor("b"), body: {} });
    assert.equal(other.statusCode, 429);
    assert.deepEqual(JSON.parse(Buffer.concat(other.chunks).toString("utf8")),
      { ok: false, error: "server_key_used", byok: true });

    const same = await callRelay(r2.relay, { headers: headersFor("a"), body: {} });
    assert.equal(same.statusCode, 200);
  });

  it("a throwing cache never crashes the request (memory fallback)", async () => {
    const broken = {
      async get() { throw new Error("cache down"); },
      async set() { throw new Error("cache down"); },
    };
    const { relay, seen } = relayWithStore(createSessionStore({ cache: broken }));
    const res = await callRelay(relay, { headers: headersFor("a"), body: {} });
    assert.equal(res.statusCode, 200);
    assert.equal(seen.calls, 1);
  });

  it("relay/build.mjs keeps @vercel/functions external with a dist dependency", async () => {
    const src = readFileSync(new URL("../../relay/build.mjs", import.meta.url), "utf8");
    assert.ok(src.includes("@vercel/functions"));
    assert.ok(src.includes("external"));
    assert.ok(src.includes('"@vercel/functions": "^3"'));
  });
});
