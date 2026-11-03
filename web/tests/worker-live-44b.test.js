import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWorkerRunner } from "../src/chat/engine.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond, ms = 5000) {
  const t0 = Date.now();
  for (;;) {
    if (cond()) return;
    if (Date.now() - t0 > ms) throw new Error("waitFor timed out");
    await sleep(2);
  }
}

class FakeWorker {
  constructor() {
    this.posted = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
    this.onPost = null;
  }
  postMessage(msg) {
    this.posted.push(msg);
    if (this.onPost) this.onPost(msg);
  }
  terminate() {
    this.terminated = true;
  }
  receive(data) {
    if (this.onmessage) this.onmessage({ data });
  }
}

const answerOf = (fake, id) => fake.posted.find((m) => m.decisionAnswer && m.decisionAnswer.requestId === id);

describe("worker live 44b", () => {
  it("handles two decisions in order; resolves only on final", async () => {
    const fake = new FakeWorker();
    const secret = "test-only-secret-9f8e7d6c5b";
    const seenSteps = [];
    const decide = async (ctx) => {
      assert.ok(!JSON.stringify(ctx).includes(secret), "context must not carry the key");
      seenSteps.push(ctx.step);
      return { chosen_key: "s1", chosen_by: "model", reason_ko: "테스트", reason_en: "test" };
    };
    const run = createWorkerRunner(() => fake, { timeoutMs: 5000, decide });
    let finished = false;
    const p = run({ tiny: true }, ["A"], () => {}).then((runs) => {
      finished = true;
      return runs;
    });
    fake.receive({ decisionRequest: { requestId: "r1", context: { step: 1 } } });
    await waitFor(() => !!answerOf(fake, "r1"));
    assert.equal(finished, false);
    fake.receive({ decisionRequest: { requestId: "r2", context: { step: 2 } } });
    await waitFor(() => !!answerOf(fake, "r2"));
    assert.equal(finished, false);
    fake.receive({ ok: true, runs: { A: { trips: [] } } });
    const runs = await p;
    assert.deepEqual(runs, { A: { trips: [] } });
    assert.deepEqual(seenSteps, [1, 2]);
    assert.equal(answerOf(fake, "r1").decisionAnswer.entry.chosen_key, "s1");
    assert.ok(fake.posted[0].scenarioInline && fake.posted[0].labels);
    assert.ok(!fake.posted.map((m) => JSON.stringify(m)).join("\n").includes(secret));
    assert.equal(fake.terminated, true);
  });

  it("callback error posts decisionError and rejects", async () => {
    const fake = new FakeWorker();
    fake.onPost = (msg) => {
      if (msg.decisionError) {
        fake.receive({ ok: false, error: "worker stopped: judge down" });
      }
    };
    const run = createWorkerRunner(() => fake, {
      timeoutMs: 5000,
      decide: async () => { throw new Error("judge down"); },
    });
    const p = run({ tiny: true }, ["A"]);
    fake.receive({ decisionRequest: { requestId: "r9", context: {} } });
    await assert.rejects(p, /judge down/);
    assert.equal(fake.posted.filter((m) => m.decisionError).length, 1);
    assert.equal(fake.terminated, true);
  });

  it("timeout with no messages rejects and terminates", async () => {
    const fake = new FakeWorker();
    const run = createWorkerRunner(() => fake, { timeoutMs: 30, decide: async () => ({}) });
    await assert.rejects(run({ tiny: true }, ["A"]), /timed out/);
    assert.equal(fake.terminated, true);
  });

  it("progress re-arms the inactivity budget", async () => {
    const fake = new FakeWorker();
    const got = [];
    const run = createWorkerRunner(() => fake, { timeoutMs: 30 });
    const p = run({ tiny: true }, ["A"], (pr) => got.push(pr));
    let n = 0;
    const timer = setInterval(() => {
      n++;
      if (n <= 5) fake.receive({ progress: { n } });
      else {
        clearInterval(timer);
        fake.receive({ ok: true, runs: { A: 1 } });
      }
    }, 15);
    const runs = await p;
    assert.deepEqual(runs, { A: 1 });
    assert.equal(got.length, 5);
    assert.equal(fake.terminated, true);
  });

  it("late answer after timeout posts nothing and resolves nothing", async () => {
    const fake = new FakeWorker();
    const run = createWorkerRunner(() => fake, { timeoutMs: 30, decide: async () => ({ chosen_key: "s1" }) });
    const p = run({ tiny: true }, ["A"]);
    await assert.rejects(p, /timed out/);
    const postedBefore = fake.posted.length;
    fake.receive({ ok: true, runs: { A: 1 } });
    await sleep(20);
    assert.equal(fake.posted.length, postedBefore);
    assert.equal(fake.terminated, true);
    await assert.rejects(p, /timed out/);
  });

  it("old no-options contract still works; progress is not completion", async () => {
    const fake = new FakeWorker();
    const seen = [];
    const run = createWorkerRunner(() => fake, { timeoutMs: 5000 });
    let finished = false;
    const p = run({ tiny: true }, ["A"], (pr) => seen.push(pr)).then((runs) => {
      finished = true;
      return runs;
    });
    fake.receive({ progress: { home: "A" } });
    assert.equal(finished, false);
    fake.receive({ ok: true, runs: { A: 7 } });
    assert.deepEqual(await p, { A: 7 });
    assert.deepEqual(seen, [{ home: "A" }]);
    assert.equal(fake.terminated, true);
  });
});
