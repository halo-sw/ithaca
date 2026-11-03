import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postDecision } from "../src/ui/consult-client.js";
import { createWorkerRunner } from "../src/chat/engine.js";

const noSleep = async () => {};
const ctx = { step: 1 };

function resp({ status, payload, retryAfter = null }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (String(k).toLowerCase() === "retry-after" ? retryAfter : null) },
    json: async () => payload,
  };
}

describe("49a decision 429 wait", () => {
  it("429 rate_limited waits then retries the same request", async () => {
    const seen = [];
    const bodies = [];
    const waits = [];
    let n = 0;
    const fetchFn = async (url, opts) => {
      seen.push(opts);
      bodies.push(opts.body);
      n += 1;
      if (n === 1) return resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: 2 }, retryAfter: "2" });
      return resp({ status: 200, payload: { ok: true, entry: { chosen_key: "s1" } } });
    };
    const out = await postDecision({ provider: "meta", context: ctx },
      { onWait: (w) => waits.push(w.remainingSec), fetchFn, sleepFn: noSleep });
    assert.equal(out.entry.chosen_key, "s1");
    assert.equal(seen.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(seen[0].body, seen[1].body);
    assert.deepEqual(JSON.parse(seen[0].body).context, ctx);
    assert.ok(waits.includes(2) && waits.includes(1));
  });

  it("refuses non-rate_limited, unbounded and malformed delays", async () => {
    const cases = [
      resp({ status: 429, payload: { ok: false, error: "server_key_used" }, retryAfter: "2" }),
      resp({ status: 429, payload: { ok: false, error: "open_limit" }, retryAfter: "2" }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: 601 }, retryAfter: "601" }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: 0 } }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: true } }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: [2] } }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: { sec: 2 } } }),
      resp({ status: 429, payload: { ok: false, error: "rate_limited" } }),
      resp({ status: 401, payload: { ok: false, error: "auth" } }),
    ];
    for (const r of cases) {
      let calls = 0;
      const fetchFn = async () => { calls += 1; return r; };
      await assert.rejects(
        postDecision({ provider: "meta", context: ctx }, { fetchFn, sleepFn: noSleep }),
      );
      assert.equal(calls, 1);
    }
    // header fallback works when payload omits the delay
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      if (calls === 1) return resp({ status: 429, payload: { ok: false, error: "rate_limited" }, retryAfter: "2" });
      return resp({ status: 200, payload: { ok: true, entry: { chosen_key: "s0" } } });
    };
    const out = await postDecision({ provider: "meta", context: ctx }, { fetchFn, sleepFn: noSleep });
    assert.equal(out.entry.chosen_key, "s0");
    assert.equal(calls, 2);
  });

  it("bounds retries at 2 and aborts the wait", async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: 600 }, retryAfter: "600" });
    };
    await assert.rejects(
      postDecision({ provider: "meta", context: ctx }, { fetchFn, sleepFn: noSleep }),
    );
    assert.equal(calls, 3); // initial + 2 retries

    // abort during wait: no second fetch, abort code (not timeout)
    let calls2 = 0;
    const fetchFn2 = async () => {
      calls2 += 1;
      return resp({ status: 429, payload: { ok: false, error: "rate_limited", retryAfterSec: 5 } });
    };
    const ctrl = new AbortController();
    const p = postDecision({ provider: "meta", context: ctx },
      { signal: ctrl.signal, fetchFn: fetchFn2, sleepFn: () => new Promise((r) => setTimeout(r, 50)) });
    await new Promise((r) => setTimeout(r, 10));
    ctrl.abort();
    const err = await p.then(() => null, (e) => e);
    assert.ok(err);
    assert.equal(err.code, "aborted");
    assert.notEqual(err.code, "timeout");
    assert.equal(calls2, 1);
  });
});

describe("49a worker wait relay", () => {
  it("heartbeat survives timeout, retains progress, clears on resume, no late post", async () => {
    const posted = [];
    const seenProgress = [];
    let workerMsg = null;
    const fake = {
      posted,
      terminated: false,
      onmessage: null,
      onerror: null,
      postMessage(m) { posted.push(m); if (this.onPost) this.onPost(m); },
      terminate() { this.terminated = true; },
      receive(d) { if (this.onmessage) this.onmessage({ data: d }); },
    };
    let capturedSignal = null;
    let decideResolve = null;
    const decide = (context, opts) => new Promise((resolve) => {
      capturedSignal = opts.signal;
      let left = 3;
      const beat = setInterval(() => {
        if (capturedSignal && capturedSignal.aborted) { clearInterval(beat); return; }
        opts.onWait({ remainingSec: left });
        left = left > 1 ? left - 1 : 3;
      }, 40);
      decideResolve = (entry) => { clearInterval(beat); resolve(entry); };
      opts.onWait({ remainingSec: 3 });
    });
    const run = createWorkerRunner(() => fake, { timeoutMs: 120, decide });
    const p = run({ tiny: true }, ["A"], (pg) => { seenProgress.push(pg); });
    fake.receive({ progress: { done: 4, total: 10, label: "woon", decision: { n: 1 } } });
    fake.receive({ decisionRequest: { requestId: "r1", context: {} } });
    await new Promise((r) => setTimeout(r, 180)); // past timeoutMs: onWait rearmed, still alive
    const waits = seenProgress.filter((g) => g && g.decisionWait && g.decisionWait.remainingSec);
    assert.ok(waits.length >= 2);
    assert.equal(waits[0].done, 4);
    assert.equal(waits[0].label, "woon");
    assert.equal(waits[0].decision.n, 1);
    decideResolve({ chosen_key: "s1" });
    await new Promise((r) => setTimeout(r, 20));
    const clear = seenProgress.find((g) => g && "decisionWait" in g && !g.decisionWait);
    assert.ok(clear, "wait-clear emitted on resume");
    assert.ok(posted.find((m) => m.decisionAnswer && m.decisionAnswer.requestId === "r1"));
    fake.receive({ ok: true, runs: { A: {} } });
    await p;
    assert.equal(capturedSignal.aborted, true);
    const nPosts = posted.length;
    fake.receive({ decisionRequest: { requestId: "late", context: {} } });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(posted.length, nPosts, "no late worker post after settle");
    void workerMsg;
  });
});
