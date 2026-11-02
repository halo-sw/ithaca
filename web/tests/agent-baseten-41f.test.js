// Stage 41f: agent.js needs no logic change — this test proves the
// request body's provider reaches providerConfig(provider) and every
// completeWithTools call in the turn (baseten included).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tinyArea, tinyScenario } from "./engine-fixture.js";
import { runTurn } from "../src/consult/agent.js";
import { createRunCache } from "../src/consult/tools.js";

function scenario() {
  return tinyScenario({
    days: 2, background: 0, seed: 7,
    homes: [
      { label: "A", area: "pangyo", complex_name: "알파" },
      { label: "B", area: "pangyo", complex_name: "베타" },
    ],
  });
}

function capturing(steps) {
  let n = 0;
  const providers = [];
  const fn = async (args) => {
    providers.push(args.provider);
    const step = steps[Math.min(n++, steps.length - 1)];
    return step();
  };
  fn.providers = providers;
  return fn;
}

const toolReply = (calls) => async () => ({
  message: { content: "", tool_calls: calls }, finish: "tool_calls",
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  latency_ms: 1, provider: "baseten", model: "meta-models/muse-spark-open-1026",
});

const textReply = (content) => async () => ({
  message: { content, tool_calls: [] }, finish: "stop",
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  latency_ms: 1, provider: "baseten", model: "meta-models/muse-spark-open-1026",
});

describe("41f agent provider passthrough", () => {
  it("threads provider baseten through providerConfig and complete", async () => {
    const complete = capturing([
      toolReply([{ id: "c1", name: "get_scenario", args: {} }]),
      textReply("시나리오를 확인했어요"),
    ]);
    const out = await runTurn({
      provider: "baseten",
      scenario: scenario(),
      cache: createRunCache(),
      loadArea: async () => tinyArea(),
      messages: [{ role: "user", content: "상황 알려줘" }],
      completeFn: complete,
    });
    assert.ok(complete.providers.length >= 2);
    assert.ok(complete.providers.every((p) => p === "baseten"));
    assert.equal(out.provider, "baseten");
    assert.equal(out.model, "meta-models/muse-spark-open-1026");
  });

  it("rejects an unknown provider before any model call", async () => {
    let calls = 0;
    await assert.rejects(
      runTurn({
        provider: "x",
        scenario: scenario(),
        cache: createRunCache(),
        loadArea: async () => tinyArea(),
        messages: [{ role: "user", content: "hi" }],
        completeFn: async () => { calls += 1; throw new Error("must not run"); },
      }),
      /unknown provider/,
    );
    assert.equal(calls, 0);
  });
});
