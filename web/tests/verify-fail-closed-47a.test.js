// Stage 47a: semantic verification is fail-closed (node --test).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadGroundTruth } from "../src/verify/checklist.js";
import { judgeEvidence } from "../src/verify/evidence.js";
import { attemptSummary } from "../src/verify/loop.js";
import { verifyComparison, runComparisonLoop } from "../src/verify/compare.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

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
      { id: `${prefix}-late`, agent: "m1", day: 12, purpose: "commute",
        minutes: 13, depart_min: 1347, arrive_min: 1360,
        from: { kind: "work", label: "Meta HQ (1 Hacker Way)" },
        to: { kind: "home", label: "집" } },
      { id: `${prefix}-am2`, agent: "m2", day: 11, purpose: "commute",
        minutes: 25, depart_min: 480,
        from: { kind: "home", label: "집" }, to: { kind: "work", label: "일터" } },
      { id: `${prefix}-pm2`, agent: "m2", day: 11, purpose: "commute",
        minutes: 25, depart_min: 1000, arrive_min: 1025,
        from: { kind: "work", label: "일터" }, to: { kind: "home", label: "집" } },
      { id: `${prefix}-err`, agent: "m1", day: 13, purpose: "errand",
        minutes: 10, depart_min: 600,
        from: { kind: "home", label: "집" }, to: { kind: "shop", label: "마트" } },
    ],
    aways: [],
    decisions: [],
  };
}

const HOME = { monthly_won: 500000, maintenance_won_month: 100000,
  utilities_won_month: 50000 };
const sHome = (home, id, item_id, text_ko, claims = [], evidence = []) =>
  ({ id, home, item_id, text_ko, claims, evidence });

describe("47a judgeEvidence fail-closed", () => {
  const run = cmpRun("j");
  const loaded = loadGroundTruth(GT, "newlywed_couple");
  const cited = { id: "s1", item_id: "C06", text_ko: "밤길이 걱정이에요",
    evidence: ["j-late"] };

  it("null judge cannot pass", async () => {
    const { failures } = await judgeEvidence(
      { sentences: [cited] }, run, loaded, null);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].kind, "judge_unverified");
    assert.ok(failures[0].reason_ko.includes("검사 미완료"));
    assert.ok(failures[0].reason_en.length > 0);
  });
  it("throwing judge cannot pass but preserves judge_error", async () => {
    const res = await judgeEvidence({ sentences: [cited] }, run, loaded,
      async () => { throw new Error("down"); });
    assert.equal(res.failures.length, 1);
    assert.equal(res.failures[0].kind, "judge_unverified");
    assert.equal(res.judge_error, true);
  });
  it("null and malformed verdicts cannot pass", async () => {
    for (const verdict of [null, undefined, {}, { supported: "yes" },
      { supported: 1 }, { supported: null }, { reason: "x" }]) {
      const { failures } = await judgeEvidence(
        { sentences: [cited] }, run, loaded, async () => verdict);
      assert.equal(failures.length, 1, JSON.stringify(verdict));
      assert.equal(failures[0].kind, "judge_unverified");
    }
  });
  it("strictly boolean true passes", async () => {
    const { failures } = await judgeEvidence(
      { sentences: [cited] }, run, loaded, async () => ({ supported: true }));
    assert.deepEqual(failures, []);
  });
  it("deterministic-only sentences need no judge", async () => {
    const det = { id: "d1", item_id: "C01", text_ko: "통근 22분",
      claims: [{ field: "minutes", value: 22, unit: "분" }],
      evidence: ["j-late"] };
    const { failures } = await judgeEvidence(
      { sentences: [det] }, run, loaded, null);
    assert.deepEqual(failures, []);
  });
});

describe("47a verifyComparison fail-closed", () => {
  const runs = { A: cmpRun("a"), B: cmpRun("b") };
  const homes = { A: HOME, B: HOME };
  const labels = ["A", "B"];
  const min = (value, member) => ({ field: "minutes", value, unit: "분",
    ...(member === undefined ? {} : { member }) });
  const full = (label, prefix) => [
    sHome(label, `${label}-c01`, "C01", "통근은 평균 22분이에요", [min(22)]),
    sHome(label, `${label}-c02`, "C02", "월 주거비는 650000원이에요",
      [{ field: "monthly_total", value: 650000, unit: "원" }]),
    sHome(label, `${label}-c05`, "C05", "장보기는 10분 거리예요", [min(10)]),
    sHome(label, `${label}-c06`, "C06", "밤늦게 도착한 날이 있어요",
      [], [`${prefix}-dark`]),
    sHome(label, `${label}-n01`, "N01", "두 사람 통근은 19분과 25분이에요",
      [min(19, "m1"), min(25, "m2")]),
    sHome(label, `${label}-n03`, "N03", "늦은 밤에도 다녀왔어요",
      [], [`${prefix}-late`]),
  ];
  const report = { persona: "newlywed_couple",
    sentences: [...full("A", "a"), ...full("B", "b")] };

  it("positive judge can pass with passed status", async () => {
    const res = await verifyComparison(report,
      { runs, labels, homes, persona: "newlywed_couple", groundTruth: GT,
        judge: async () => ({ supported: true }) });
    assert.equal(res.pass, true);
    assert.equal(res.status, "passed");
  });
  it("mixed A checked / B failed cannot pass", async () => {
    const judge = async (sentence) => sentence.home === "A"
      ? { supported: true }
      : { supported: false, reason: "시간이 안 맞아요" };
    const res = await verifyComparison(report,
      { runs, labels, homes, persona: "newlywed_couple", groundTruth: GT, judge });
    assert.equal(res.pass, false);
    assert.equal(res.status, "failed");
    assert.ok(res.by_home.B.failures.some((f) => f.kind === "judge"));
    assert.equal(res.by_home.A.status, "passed");
    assert.equal(res.by_home.B.status, "failed");
  });
  it("no labels cannot vacuously pass", async () => {
    const res = await verifyComparison(report,
      { runs, labels: [], homes: {}, persona: "newlywed_couple",
        groundTruth: GT, judge: async () => ({ supported: true }) });
    assert.equal(res.pass, false);
    assert.ok(res.status === "failed" || res.status === "unverified");
  });
  it("unverified attempt summary comes first", () => {
    const s = attemptSummary({ status: "unverified", pass: false,
      weighted_coverage: 0.5, failures: [{ reason_ko: "x" }] });
    assert.equal(s, "검증 미완료: 의미 검사를 끝내지 못했어요. 다시 확인해 주세요.");
  });
  it("unverified loop stops without revise and persists status", async () => {
    let reviseCalls = 0;
    const seen = [];
    const { result, attempts, handoff } = await runComparisonLoop({
      draft: report, revise: async (r) => { reviseCalls += 1; return r; },
      runs, labels, homes, persona: "newlywed_couple", groundTruth: GT,
      judge: null, onAttempt: (info) => seen.push(info),
    });
    assert.equal(result.status, "unverified");
    assert.equal(result.pass, false);
    assert.equal(attempts.length, 1);
    assert.equal(reviseCalls, 0);
    assert.equal(handoff.ask_user, true);
    assert.equal(seen[0].status, "unverified");
    assert.ok(seen[0].summary_ko.startsWith("검증 미완료"));
    assert.equal(attempts[0].result.status, "unverified");
  });
  it("false verdict is a normal failure and still retries", async () => {
    let reviseCalls = 0;
    const { result, attempts } = await runComparisonLoop({
      draft: report, revise: async (r) => { reviseCalls += 1; return r; },
      runs, labels, homes, persona: "newlywed_couple", groundTruth: GT,
      judge: async () => ({ supported: false, reason: "시간이 안 맞아요" }),
      maxRetries: 1,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.pass, false);
    assert.equal(attempts.length, 2);
    assert.equal(reviseCalls, 1);
  });
});
