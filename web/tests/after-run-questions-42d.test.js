// Stage 42d — after-run questions get real answers, with or without
// Muse (pure, node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let Chat;
let formatAgentContext;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
  ({ formatAgentContext } = await import("../src/consult/agent.js"));
});

const PEOPLE = [
  { key: "h1", label: "나", role: "self" },
  { key: "h2", label: "배우자", role: "spouse" },
];

function dayEntries(day, { late = false } = {}) {
  const entries = {
    h1: [{ minute: 490, end_minute: 520, kind: "subway",
      text: "08:10 집에서 출발 → 08:40 회사 도착 (지하철 30분)" }],
    h2: [{ minute: 485, end_minute: 520, kind: "subway",
      text: "08:05 집에서 출발 → 08:40 회사 도착 (지하철 35분, 서서 10분)" }],
  };
  if (day === 6) {
    entries.h2.push({ minute: 600, end_minute: 640, kind: "park", text: "공원 40분" });
  }
  if (day === 13) {
    entries.h2.push({ minute: 840, end_minute: 865, kind: "errand",
      text: "14:00 장보기 25분 (마트까지 걸어서 8분)" });
  }
  if (late && day === 14) {
    entries.h2.push({ minute: 1334, end_minute: null, kind: "home", text: "22:14 늦은 귀가" });
  }
  return entries;
}

function personLog({ late = true } = {}) {
  const days = [];
  for (let day = 1; day <= 30; day += 1) {
    days.push({ day,
      entries: dayEntries(day, { late }),
      summary: { h1: "출근 · 회사", h2: "출근 · 회사" } });
  }
  return { people: PEOPLE, days };
}

function moneyDoc() {
  return {
    default_tenure: { A: "매매", B: "매매" },
    homes: {
      A: { by_tenure: { 매매: {
        housing: { monthly_won: 450000, loan_won: 80000000,
          rate_pct: 4.5, years: 30, upfront_won: 300000000, cash_used_won: 220000000 },
        totals_by_category: { maintenance: 150000, transit: 80000 } } } },
      B: { by_tenure: { 매매: {
        housing: { monthly_won: 600000, loan_won: 150000000,
          rate_pct: 4.5, years: 30, upfront_won: 500000000, cash_used_won: 350000000 },
        totals_by_category: { maintenance: 200000, transit: 100000 } } } },
    },
  };
}

function simData({ late = true } = {}) {
  return { status: "done", customId: "run-42d",
    labels: ["A", "B"],
    names: { A: "역삼", B: "서현" },
    moments: [{ label: "A", day: 3, t: "08:20" }, { label: "B", day: 4, t: "08:25" }],
    compare: { days: 30, one_way: { A: 37, B: 42 } },
    moneyDoc: moneyDoc(),
    personLog: { A: personLog({ late }), B: personLog({ late: false }) },
    lifeEvents: [{ kind: "seated", a: { seated: 20, measured: 25 },
      b: { seated: 10, measured: 25 }, source: "실측 혼잡도" }],
    noCommute: false };
}

function thread({ late = true } = {}) {
  const messages = [{ role: "assistant", kind: "simulation", data: simData({ late }) }];
  const picks = ["h-a", "h-b"];
  const candidates = [
    { id: "h-a", name: "역삼", scene: "area-a" },
    { id: "h-b", name: "서현", scene: "area-b" },
    { id: "h-c", name: "반포", scene: "area-c" },
  ];
  return { messages, picks, candidates };
}

function answer(text, opts, lang = "ko") {
  const { messages, picks, candidates } = opts || thread();
  return Chat.afterRunAnswer(text, { messages, picks, candidates, lang });
}

const NO_HANGUL = /[가-힣]/;

describe("42d after-run questions (Korean)", () => {
  it("1 배우자 30일: weekday pattern + weekend outing days + scene", () => {
    const r = answer("배우자는 30일 동안 뭐 했어?", thread());
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("6일차") && r.line.includes("공원"), r.line);
    assert.ok(r.line.includes("13일차") && r.line.includes("장보기"), r.line);
    assert.ok(r.scene && r.scene.panel === "result", "opens a stage moment");
  });

  it("2 늦은 귀가: days and times per home from the log", () => {
    const r = answer("밤 10시 넘어서 집에 온 날 있어?", thread());
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("14일차") && r.line.includes("22:14"), r.line);
  });

  it("3 B 출근길: B commute scene + one-way minutes", () => {
    const r = answer("B 집 출근길도 보여 줘", thread());
    assert.deepEqual(r.scene, { panel: "commute", home: "B" });
    assert.ok(r.line.includes("42분"), r.line);
  });

  it("4 붐벼: standing minutes per home from the log", () => {
    const r = answer("출근 지하철 많이 붐벼?", thread());
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("10분"), r.line);
    assert.ok(r.line.includes("20/25"), `seated counts: ${r.line}`);
  });

  it("5 어디가 나아: 2 contrasts, no winner", () => {
    const r = answer("둘 중 어디가 더 나아?", thread());
    assert.ok(r.line.includes("37분") && r.line.includes("42분"), r.line);
    assert.ok(r.line.includes("68만") && r.line.includes("90만"), r.line);
    assert.ok(r.line.includes("고르는 건 고객님 몫이에요."), r.line);
    assert.ok(!r.line.includes("추천"), `no winner: ${r.line}`);
  });

  it("6 대출: loan amount + money tab", () => {
    const r = answer("대출은 얼마나 받아야 해?", thread());
    assert.equal(r.tab, "money");
    assert.ok(r.line.includes("8,000만") && r.line.includes("45만"), r.line);
  });

  it("7 전세: jeonse tab", () => {
    const r = answer("전세로 하면 어때?", thread());
    assert.equal(r.tab, "jeonse");
    assert.ok(r.line && r.line.length > 0, "reply");
  });

  it("8 주말: outing days per person + scene", () => {
    const r = answer("주말에는 뭐 했어?", thread());
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("6일차") && r.line.includes("13일차"), r.line);
    assert.ok(r.scene && r.scene.panel === "result", "opens a stage moment");
  });

  it("9 공원/마트: tour scene + Muse line (no place data)", () => {
    const r = answer("근처에 공원이나 마트 있어?", thread());
    assert.deepEqual(r.scene, { panel: "tour", home: "A" });
    assert.ok(r.line.includes("Muse가 찾아 줘요"), r.line);
  });

  it("9b places data on the candidate: nearest with walk minutes", () => {
    const t = thread();
    t.candidates[0] = { ...t.candidates[0],
      places: [{ name: "한강공원", kind: "공원", walk_minutes: 7 }] };
    const r = answer("근처에 공원 있어?", t);
    assert.ok(r.line.includes("한강공원") && r.line.includes("7분"), r.line);
  });

  it("10 학교: tour scene + Muse line (no school data)", () => {
    const r = answer("아이 생기면 학교는 가까워?", thread());
    assert.deepEqual(r.scene, { panel: "tour", home: "A" });
    assert.ok(r.line && r.line.length > 0, "reply");
  });

  it("11 3번 집 비교: keep A+B, add N, run 3 ids", () => {
    const r = answer("3번 집이랑도 비교해 줘", thread());
    assert.deepEqual(r.pick, ["h-a", "h-b", "h-c"]);
    assert.deepEqual(r.run, ["h-a", "h-b", "h-c"]);
    assert.ok(r.line.includes("반포"), r.line);
  });

  it("12 관리비 포함 한 달: per-home totals + money tab", () => {
    const r = answer("관리비 포함하면 한 달에 얼마야?", thread());
    assert.equal(r.tab, "money");
    assert.ok(r.line.includes("68만") && r.line.includes("90만"), r.line);
    assert.ok(r.line.includes("관리비"), r.line);
  });

  it("no late returns: the 없었어요 line", () => {
    const r = answer("밤 10시 넘어서 집에 온 날 있어?", thread({ late: false }));
    assert.equal(r.line, "30일 동안 밤 10시 넘어 들어온 날은 없었어요.");
  });

  it("unknown question: 42f null so the rule flow runs", () => {
    const r = answer("내일 날씨 어때?", thread());
    assert.equal(r, null);
  });

  it("picked-only compare request never drops to one home", () => {
    const r = answer("3번 집이랑도 비교해 줘", thread());
    assert.ok(r.run.length === 3 && r.run.includes("h-a") && r.run.includes("h-b"),
      "keeps A and B in the run");
  });
});

describe("42d after-run questions (English)", () => {
  it("spouse: outing days, no invented text", () => {
    const r = answer("What did my spouse do during the 30 days?", thread(), "en");
    assert.ok(r.line.includes("day 6") && r.line.includes("day 13"), r.line);
  });

  it("late: day + time", () => {
    const r = answer("Any nights you came home after 10?", thread(), "en");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("14") && r.line.includes("22:14"), r.line);
  });

  it("home B commute: scene + minutes, no Hangul", () => {
    const r = answer("Show home B's commute too", thread(), "en");
    assert.deepEqual(r.scene, { panel: "commute", home: "B" });
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("42 min"), r.line);
  });

  it("crowded: standing minutes, no Hangul", () => {
    const r = answer("Is the subway to work crowded?", thread(), "en");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("10 min"), r.line);
  });

  it("which is better: contrasts + yours, no Hangul", () => {
    const r = answer("Which one is better?", thread(), "en");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("37 min") && r.line.includes("42 min"), r.line);
    assert.ok(r.line.includes("The choice is yours."), r.line);
  });

  it("loan: amounts + money tab, no Hangul", () => {
    const r = answer("How much loan do I need?", thread(), "en");
    assert.equal(r.tab, "money");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("80,000,000 won"), r.line);
  });

  it("jeonse: tab, no Hangul", () => {
    const r = answer("What about jeonse?", thread(), "en");
    assert.equal(r.tab, "jeonse");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
  });

  it("weekend: outing days", () => {
    const r = answer("What did you do on weekends?", thread(), "en");
    assert.ok(r.line.includes("day 6") && r.line.includes("day 13"), r.line);
  });

  it("parks: tour scene + Muse line, no Hangul", () => {
    const r = answer("Are there parks or marts nearby?", thread(), "en");
    assert.deepEqual(r.scene, { panel: "tour", home: "A" });
    assert.ok(!NO_HANGUL.test(r.line), r.line);
  });

  it("schools: tour scene, no Hangul", () => {
    const r = answer("Are schools nearby for kids?", thread(), "en");
    assert.deepEqual(r.scene, { panel: "tour", home: "A" });
    assert.ok(!NO_HANGUL.test(r.line), r.line);
  });

  it("compare home 3: 3 ids, no Hangul", () => {
    const r = answer("Compare with home 3 too", thread(), "en");
    assert.deepEqual(r.run, ["h-a", "h-b", "h-c"]);
    assert.ok(!NO_HANGUL.test(r.line), r.line);
  });

  it("monthly with maintenance: totals + tab, no Hangul", () => {
    const r = answer("How much a month including maintenance?", thread(), "en");
    assert.equal(r.tab, "money");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(r.line.includes("680,000 won") && r.line.includes("900,000 won"), r.line);
  });

  it("unknown: 42f null so the rule flow runs", () => {
    const r = answer("How is the weather tomorrow?", thread(), "en");
    assert.equal(r, null);
  });
});

describe("42d never silent guard", () => {
  it("countsAsVisibleReply: only a new assistant text bubble counts", () => {
    assert.equal(Chat.countsAsVisibleReply({ role: "assistant", kind: "text", content: "x" }), true);
    assert.equal(Chat.countsAsVisibleReply(
      { role: "assistant", kind: "candidates", replace: true, data: {} }), false);
    assert.equal(Chat.countsAsVisibleReply(
      { role: "assistant", kind: "simulation", replace: true, data: {} }), false);
    assert.equal(Chat.countsAsVisibleReply({ role: "assistant", kind: "byok", content: "x" }), false);
    assert.equal(Chat.countsAsVisibleReply({ role: "system", kind: "system", content: "x" }), false);
    assert.equal(Chat.countsAsVisibleReply({ role: "user", kind: "text", content: "x" }), false);
  });

  it("a turn that only replaces a hidden card still needs the fallback", () => {
    const repliesBefore = 1;
    let countNow = repliesBefore;
    const hidden = { role: "assistant", kind: "candidates", replace: true, data: {} };
    if (Chat.countsAsVisibleReply(hidden)) countNow += 1;
    assert.equal(Chat.answeredSince(countNow, repliesBefore), false);
    const line = Chat.localNoAnswerLine("배우자는 30일 동안 뭐 했어?");
    assert.ok(line && line.length > 0, "fallback answers");
  });

  it("isCompareAddRequest matches compare + number", () => {
    assert.equal(Chat.isCompareAddRequest("3번 집이랑도 비교해 줘"), true);
    assert.equal(Chat.isCompareAddRequest("Compare with home 3 too"), true);
    assert.equal(Chat.isCompareAddRequest("둘 중 어디가 더 나아?"), false);
    assert.equal(Chat.isCompareAddRequest("출근길 보여 줘"), false);
  });
});

describe("42d runSummaryFor + agent context", () => {
  it("2-home x 2-person x 30-day summary fits 3 KB with payload numbers", () => {
    const s = Chat.runSummaryFor(simData({ late: true }));
    assert.ok(s && s.length > 0, "summary");
    assert.ok(Buffer.byteLength(s, "utf8") <= 3072, `3KB cap: ${Buffer.byteLength(s, "utf8")}`);
    assert.ok(s.includes("37") && s.includes("22:14"), s);
    assert.ok(s.includes("8,000만"), s);
  });

  it("agent context carries run_summary lines when given, none otherwise", () => {
    const withRun = formatAgentContext({ tab: "compare", run_summary: "A 역삼: 출근 편도 평균 37분." });
    assert.ok(withRun.includes("A 역삼: 출근 편도 평균 37분."), withRun);
    assert.ok(withRun.includes("살아 보기 요약"), withRun);
    const without = formatAgentContext({ tab: "compare" });
    assert.ok(!without.includes("살아 보기 요약"), without);
  });
});
