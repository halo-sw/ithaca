// Stage 42m — the "answered by rules" mark shows only on real rule
// answers (msg.ruleAnswer === true), never on the app's own run-done
// line. Pure helpers + SSR (no DOM, no keys).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));

let Chat;
let React;
let renderToStaticMarkup;
let AssistantMsg;
let RULE_ANSWER_META;
let answerMetaFor;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ AssistantMsg } = await import("../src/ui/consult.jsx"));
  ({ RULE_ANSWER_META, answerMetaFor } = await import("../src/ui/no-answer-alert.js"));
});

function simThread() {
  const messages = [{ role: "assistant", kind: "simulation",
    data: { status: "done", customId: "run-42m",
      labels: ["A", "B"],
      names: { A: "역삼", B: "서현" },
      moments: [{ label: "A", day: 3, t: "08:20" }, { label: "B", day: 4, t: "08:25" }],
      compare: { days: 30, one_way: { A: 37, B: 42 } } } }];
  const picks = ["h-a", "h-b"];
  const candidates = [
    { id: "h-a", name: "역삼", scene: "area-a" },
    { id: "h-b", name: "서현", scene: "area-b" },
    { id: "h-c", name: "반포", scene: "area-c" },
  ];
  return { messages, picks, candidates };
}

const rendered = (msg, lang = "ko") => renderToStaticMarkup(
  React.createElement(AssistantMsg, { msg, toolRows: {}, lang }));

describe("42m run-done status lines carry no rule mark", () => {
  it("a recorded run-done message renders without the mark (ko + en)", () => {
    const msg = { role: "assistant", kind: "text", fromModel: false,
      content: "Finished living there. A 777 Hamilton: average one-way commute 14 min; B 124 University Avenue: 33 min." };
    for (const lang of ["ko", "en"]) {
      const html = rendered(msg, lang);
      assert.ok(!html.includes("규칙으로 답했어요"), `${lang}: ${html}`);
      assert.ok(!html.includes("Answered by rules"), `${lang}: ${html}`);
    }
    assert.equal(answerMetaFor(msg), null);
  });

  it("fromModel false alone never marks, flag alone always marks", () => {
    assert.equal(answerMetaFor({ fromModel: false }), null);
    assert.equal(answerMetaFor({}), null);
    assert.equal(answerMetaFor({ ruleAnswer: true }), RULE_ANSWER_META);
  });
});

describe("42m after-run rule answers carry the flag and render the mark", () => {
  it("after-run answer → afterRunChipTurn carries ruleAnswer and renders the mark", () => {
    const { messages, picks, candidates } = simThread();
    const chip = Chat.afterRunAnswer("B 집 출근길도 보여 줘",
      { messages, picks, candidates, lang: "ko" });
    assert.ok(chip && chip.line, "rule answer");
    assert.ok(!chip.run, "not an action line");
    const [msg] = Chat.afterRunChipTurn(chip);
    assert.equal(msg.ruleAnswer, true);
    const html = rendered(msg);
    assert.ok(html.includes(RULE_ANSWER_META));
    assert.ok(html.includes("규칙으로 답했어요"));
  });

  it("compare-add action line is the app's own line: no flag, no mark", () => {
    const { messages, picks, candidates } = simThread();
    const chip = Chat.afterRunAnswer("3번 집이랑도 비교해 줘",
      { messages, picks, candidates, lang: "ko" });
    assert.ok(chip && chip.run, "action line");
    const [msg] = Chat.afterRunChipTurn(chip);
    assert.equal(msg.ruleAnswer, undefined);
    const html = rendered(msg);
    assert.ok(!html.includes("규칙으로 답했어요"));
    assert.ok(!html.includes("Answered by rules"));
  });
});

describe("42m recorded replays show no rule mark on any message", () => {
  for (const file of ["menlo-month.json", "seoul-couple.json"]) {
    it(`${file}: no message renders the mark`, () => {
      const doc = JSON.parse(fs.readFileSync(
        path.join(here, "..", "public", "recorded", file), "utf8"));
      const messages = Array.isArray(doc) ? doc : doc.messages;
      assert.ok(messages.length > 0, "recording has messages");
      for (const m of messages) {
        if (!m || m.role !== "assistant") continue;
        const html = rendered({ ...m });
        assert.ok(!html.includes("규칙으로 답했어요"), `${file} ${m.id}: ${html}`);
        assert.ok(!html.includes("Answered by rules"), `${file} ${m.id}: ${html}`);
      }
    });
  }
});
