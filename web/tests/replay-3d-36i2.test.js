// 36i2: in a recorded replay every moment opens the 3D at its minute.
// replayRunPlan rebuilds the run from the recording; the replay boot
// recomputes it under the same custom id; SceneFrame waits on it.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const doc = JSON.parse(read("../public/recorded/seoul-couple.json"));

describe("36i2 replayRunPlan", () => {
  let replayRunPlan;
  before(async () => {
    ({ replayRunPlan } = await import("../src/chat/recording.js"));
  });

  it("reads the plan off the real recording", () => {
    const plan = replayRunPlan(doc);
    assert.ok(plan, "plan");
    const doneSims = doc.messages.filter((m) => m.kind === "simulation" && m.data?.status === "done");
    const expectedId = doneSims[doneSims.length - 1]?.data?.customId;
    assert.equal(typeof expectedId, "string", "recording has a done simulation id");
    assert.ok(expectedId.length > 0, "recording id is non-empty");
    assert.equal(plan.customId, expectedId);
    assert.deepEqual(plan.labels, ["A", "B"]);
    assert.equal(typeof plan.scenario.seed, "number");
    assert.ok(plan.scenario && typeof plan.scenario === "object", "scenario");
    assert.ok(plan.moneyDoc && typeof plan.moneyDoc === "object", "moneyDoc");
  });

  it("returns null when there is nothing to rebuild", () => {
    assert.equal(replayRunPlan({ messages: [] }), null);
    assert.equal(replayRunPlan(null), null);
  });

  it("picks the last done run and rejects incomplete cards", () => {
    const sim = (customId, extra = {}) => ({
      kind: "simulation",
      data: { status: "done", customId, labels: ["A", "B"],
        names: { A: "a", B: "b" }, moneyDoc: { days: 30 }, moneyMissing: "", ...extra },
    });
    const base = { scenario: { seed: 7 }, messages: [sim("cold"), sim("clast")] };
    assert.equal(replayRunPlan(base).customId, "clast");
    assert.equal(replayRunPlan({ scenario: { seed: 7 }, messages: [sim("cx", { moneyDoc: null })] }), null);
    assert.equal(replayRunPlan({ messages: [sim("cx")] }), null);
  });
});

describe("36i2 replay boot source", () => {
  const src = read("../src/ui/chat.jsx");
  const start = src.indexOf("replayRunPlan(doc)");
  const end = src.indexOf("setReplayMeta(doc.meta", start);
  const boot = start >= 0 && end > start ? src.slice(start, end) : "";

  it("recomputes the run under the plan id, never a fresh one", () => {
    assert.ok(start >= 0, "replay boot plans the run");
    assert.ok(boot.includes("loadCustomRun(plan.customId)"), "checks the store first");
    assert.ok(boot.includes("createWorkerRunner"), "same worker runner as live");
    assert.ok(boot.includes("sim-worker.js"), "same sim worker");
    assert.ok(boot.includes("saveCustomRun({ id: plan.customId"), "saves under the plan id");
    assert.ok(!boot.includes("newCustomId("), "never mints a fresh id");
  });

  it("never touches the consult client, messages or tool rows", () => {
    for (const name of ["postConsultStream", "postDiary", "postReportStream", "loadScenario", "requestReport"]) {
      assert.ok(!boot.includes(name), `no ${name} in the replay boot`);
    }
    assert.ok(!boot.includes("pushMsg("), "no chat messages");
    assert.ok(!boot.includes("addToolRow("), "no tool rows");
    assert.ok(boot.includes("replayRunReady"), "promise kept in replayRunReady");
  });
});

describe("36i2 SceneFrame waits for the rebuilt run (SSR)", () => {
  let React;
  let renderToString;
  let SceneFrame;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SceneFrame } = await import("../src/ui/chat.jsx"));
  });
  const scene = { url: "/sim?custom=cmvwxbyxq1806&embed=1", title: "A · 2일째 08:04" };

  it("pending: same header, preparing line, no iframe", () => {
    const html = renderToString(React.createElement(SceneFrame,
      { scene, runReady: new Promise(() => {}), onBack: () => {}, onClose: () => {} }));
    assert.ok(html.includes("A · 2일째 08:04"), "header title stays");
    assert.ok(html.includes("3D를 준비하고 있어요…"), "preparing line");
    assert.ok(html.includes("data-no-i18n"), "line opts out of translation");
    assert.ok(!html.includes("<iframe"), "no iframe while pending");
  });

  it("failed: rebuild line, no iframe", () => {
    const html = renderToString(React.createElement(SceneFrame,
      { scene, runReady: false, onBack: () => {}, onClose: () => {} }));
    assert.ok(html.includes("이 기록의 3D를 다시 계산하지 못했어요."), "rebuild line");
    assert.ok(!html.includes("<iframe"), "no iframe on failure");
  });

  it("ready: the iframe renders", () => {
    const html = renderToString(React.createElement(SceneFrame,
      { scene, runReady: true, onBack: () => {}, onClose: () => {} }));
    assert.ok(html.includes("<iframe"), "iframe when ready");
  });

  it("live scenes still open at once (no prop)", () => {
    const html = renderToString(React.createElement(SceneFrame,
      { scene, onBack: () => {}, onClose: () => {} }));
    assert.ok(html.includes("<iframe"), "iframe without runReady");
  });
});
