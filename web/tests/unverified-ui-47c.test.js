// Stage 47c: unverified state is preserved through the tool, stream,
// saved UI (pure, node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";
import { callTool } from "../src/consult/tools.js";
import { reportDigest } from "../src/verify/compare.js";
import { writeReport } from "../src/consult/report.js";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

let React;
let renderToStaticMarkup;
let ReportCheck;
let reportUnlocked;
let latestReportStatus;

before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ ReportCheck, reportUnlocked, latestReportStatus } = await import("../src/ui/chat.jsx"));
});

function cmpRun(prefix) {
  return {
    meta: { start_date: "2026-11-01", area: "seoul-x" },
    agents: [{ key: "m1", household: true }, { key: "m2", household: true }],
    trips: [
      { id: `${prefix}-am1`, agent: "m1", day: 11, purpose: "commute",
        minutes: 30, depart_min: 480,
        from: { kind: "home", label: "집" }, to: { kind: "work", label: "일터" } },
      { id: `${prefix}-dark`, agent: "m1", day: 11, purpose: "commute",
        minutes: 13, depart_min: 1097, arrive_min: 1110, mode: "bike",
        from: { kind: "work", label: "Meta HQ (1 Hacker Way)" },
        to: { kind: "home", label: "집" } },
      { id: `${prefix}-am2`, agent: "m2", day: 11, purpose: "commute",
        minutes: 25, depart_min: 480,
        from: { kind: "home", label: "집" }, to: { kind: "work", label: "일터" } },
      { id: `${prefix}-pm2`, agent: "m2", day: 11, purpose: "commute",
        minutes: 25, depart_min: 1000, arrive_min: 1025,
        from: { kind: "work", label: "일터" }, to: { kind: "home", label: "집" } },
    ],
    aways: [],
    decisions: [],
  };
}

const RUNS = { A: cmpRun("a"), B: cmpRun("b") };
const HOMES = { A: { monthly_won: 500000 }, B: { monthly_won: 600000 } };
const LABELS = ["A", "B"];
const PERSONA = "newlywed_couple";

function buildSentences() {
  const digest = reportDigest({ runs: RUNS, labels: LABELS, homes: HOMES,
    persona: PERSONA, groundTruth: GT });
  const out = [];
  for (const label of LABELS) {
    for (const item of digest.items) {
      if (item.engine === "none") continue;
      if (item.values) {
        const v = item.values[label];
        if (v === null || v === undefined) continue;
        if (item.id === "N01") {
          const claims = Object.entries(v).map(([member, vv]) =>
            ({ field: "minutes", value: vv.value, unit: vv.unit || "분", member }));
          if (claims.length === 0) continue;
          out.push({ id: `${label}n01`, home: label, item_id: item.id,
            text_ko: `${label}집 두 사람 통근 균형 문장`, claims, evidence: [] });
        } else {
          if (v.value === null || v.value === undefined) continue;
          const field = item.id === "C02" ? "monthly_total" : "minutes";
          out.push({ id: `${label}${item.id.toLowerCase()}`, home: label,
            item_id: item.id, text_ko: `${label}집 항목 비교 문장`,
            claims: [{ field, value: v.value, unit: v.unit }], evidence: [] });
        }
      } else if (item.events) {
        const evs = item.events[label] || [];
        if (evs.length === 0) continue;
        out.push({ id: `${label}${item.id.toLowerCase()}`, home: label,
          item_id: item.id, text_ko: `${label}집 밤늦게 도착한 날이 있어요`,
          claims: [], evidence: [evs[0].id] });
      }
    }
  }
  return out;
}

function toolReply(sentences, id = "call_1") {
  return { message: { content: "",
    tool_calls: [{ id, name: "submit_report", args: { sentences } }] }, usage: {} };
}

function judgeReply(obj) {
  return { message: { content: JSON.stringify(obj), tool_calls: [] }, usage: {} };
}

describe("47c submit_report preserves unverified", () => {
  it("a throwing judge returns unverified with status, null handoff, no revise", async () => {
    const full = buildSentences();
    assert.ok(full.length > 0);
    let toolCalls = 0;
    const call = async (args) => {
      if (args.tools) { toolCalls++; return toolReply(full, `call_${toolCalls}`); }
      throw new Error("judge unavailable");
    };
    const out = await writeReport({ call, provider: "meta", runs: RUNS,
      labels: LABELS, homes: HOMES, persona: PERSONA, groundTruth: GT });
    assert.equal(out.status, "unverified");
    assert.equal(out.handoff, null);
    assert.equal(out.result.pass, false);
    assert.equal(out.result.status, "unverified");
    assert.ok(out.attempts.length > 0);
    for (const a of out.attempts) assert.equal(a.status, "unverified");
    assert.equal(toolCalls, 1);
  });

  it("a malformed judge reply returns unverified with null handoff", async () => {
    const full = buildSentences();
    const call = async (args) => {
      if (args.tools) return toolReply(full);
      return judgeReply({ bogus: true });
    };
    const out = await writeReport({ call, provider: "meta", runs: RUNS,
      labels: LABELS, homes: HOMES, persona: PERSONA, groundTruth: GT });
    assert.equal(out.status, "unverified");
    assert.equal(out.handoff, null);
    assert.equal(out.result.status, "unverified");
    for (const a of out.attempts) assert.equal(a.status, "unverified");
  });

  it("an explicit passing judge still returns pass", async () => {
    const full = buildSentences();
    const call = async (args) => {
      if (args.tools) return toolReply(full);
      return judgeReply({ supported: true, reason: "ok" });
    };
    const out = await writeReport({ call, provider: "meta", runs: RUNS,
      labels: LABELS, homes: HOMES, persona: PERSONA, groundTruth: GT });
    assert.equal(out.status, "pass");
  });

  it("a true content rejection retains its handoff", async () => {
    const full = buildSentences();
    const call = async (args) => {
      if (args.tools) return toolReply(full);
      return judgeReply({ supported: false, reason: "기록과 시간이 달라요" });
    };
    const out = await writeReport({ call, provider: "meta", runs: RUNS,
      labels: LABELS, homes: HOMES, persona: PERSONA, groundTruth: GT });
    assert.equal(out.status, "handoff");
    assert.ok(out.handoff && typeof out.handoff.question_ko === "string"
      && out.handoff.question_ko.length > 0);
  });

  it("submit_report is registered", async () => {
    const { TOOL_DEFS } = await import("../src/consult/tools.js");
    assert.ok(TOOL_DEFS.some((t) => t.function.name === "submit_report"));
    void callTool;
  });
});

const SENTENCES = [
  { id: "s1", home: "A", item_id: "C01", text_ko: "통근은 평균 22분이에요",
    claims: [{ field: "minutes", value: 22, unit: "분" }], evidence: ["a-dark"] },
];

function unverifiedReport(attempts) {
  return { status: "unverified", persona: "newlywed_couple",
    attempts, report: { sentences: SENTENCES },
    result: { pass: false, status: "unverified", failures: [], feedback_ko: [] } };
}

const GOOD_ATTEMPTS = [{ attempt: 1, pass: false, status: "unverified",
  weighted_coverage: 1, must_coverage: 1,
  summary_ko: "검증 미완료: 의미 검사를 끝내지 못했어요. 다시 확인해 주세요.",
  reason_en: "semantic check unverified; meaning not confirmed" }];

describe("47c ReportCheck SSR unverified", () => {
  it("English shows retry, check-incomplete, reason_en, no pass claim or override", () => {
    const html = renderToStaticMarkup(React.createElement(ReportCheck, {
      report: unverifiedReport(GOOD_ATTEMPTS),
      names: { A: "Yeoksam" }, lang: "en",
    }));
    assert.ok(html.includes("Retry verification"));
    assert.ok(html.includes("Attempt 1: check incomplete"));
    assert.ok(html.includes("semantic check unverified; meaning not confirmed"));
    assert.ok(html.includes("The numeric checks ran, but the meaning check did not finish. This report has not passed. Retry verification."));
    assert.ok(!html.includes("Attempt 1: passed"));
    assert.ok(!html.includes("rejected"));
    assert.ok(!html.includes("통과"));
    assert.ok(!html.includes("확인했어요"));
    assert.ok(!html.includes("숫자 확인"));
  });

  it("Korean shows retry, 검사 미완료, no pass claim or override", () => {
    const html = renderToStaticMarkup(React.createElement(ReportCheck, {
      report: unverifiedReport(GOOD_ATTEMPTS),
      names: { A: "역삼" },
    }));
    assert.ok(html.includes("다시 검증하기"));
    assert.ok(html.includes("1차 검사 미완료"));
    assert.ok(html.includes("검증 미완료"));
    assert.ok(html.includes("이 리포트는 통과하지 못했어요"));
    assert.ok(!html.includes("통과 ("));
    assert.ok(!html.includes("반려"));
    assert.ok(!html.includes("확인했어요"));
    assert.ok(!html.includes("숫자 확인"));
  });

  it("without numeric coverage it makes no numeric-ran claim", () => {
    const attempts = [{ attempt: 1, pass: false, status: "unverified",
      summary_ko: "검증 미완료: 의미 검사를 끝내지 못했어요. 다시 확인해 주세요." }];
    const en = renderToStaticMarkup(React.createElement(ReportCheck, {
      report: unverifiedReport(attempts), names: {}, lang: "en",
    }));
    assert.ok(en.includes("The meaning check did not finish. This report has not passed. Retry verification."));
    assert.ok(!en.includes("numeric checks ran"));
    const ko = renderToStaticMarkup(React.createElement(ReportCheck, {
      report: unverifiedReport(attempts), names: {},
    }));
    assert.ok(!ko.includes("숫자 검사"));
    assert.ok(ko.includes("다시 검증하기"));
  });

  it("ordinary English pass still renders success", () => {
    const html = renderToStaticMarkup(React.createElement(ReportCheck, {
      report: { status: "pass", persona: "newlywed_couple",
        attempts: [{ attempt: 1, pass: true, weighted_coverage: 0.83, summary_ko: "ok" }],
        report: { sentences: SENTENCES },
        result: { failures: [], feedback_ko: [] } },
      names: { A: "Yeoksam" }, lang: "en",
    }));
    assert.ok(html.includes("Attempt 1: passed (83% coverage)"));
  });
});

describe("47c saved unverified state stays open but never verified", () => {
  const sim = (report) => [{ kind: "simulation", data: report === undefined ? {} : { report } }];
  it("unverified opens the factual simulation and keeps its status", () => {
    const saved = sim({ status: "unverified", persona: "newlywed_couple", attempts: GOOD_ATTEMPTS });
    assert.equal(reportUnlocked(saved), true);
    assert.equal(latestReportStatus(saved), "unverified");
    assert.notEqual(latestReportStatus(saved), "pass");
  });
});
