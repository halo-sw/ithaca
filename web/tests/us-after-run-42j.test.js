// Stage 42j — US after-run answers + richer run_summary (node --test).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let Chat;
let Engine;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
  Engine = await import("../src/chat/engine.js");
});

const PEOPLE = [
  { key: "h1", label: "나", role: "self" },
  { key: "h2", label: "배우자", role: "spouse" },
];

// US run: both commute 08:00 → 08:14, home 17:28 (medians land exactly).
function usEntries(day) {
  const commute = (who) => ([
    { minute: 480, end_minute: 494, kind: "subway",
      text: "08:00 left home → 08:14 arrived at work (Caltrain 14 min)" },
    { minute: 1040, end_minute: 1048, kind: "subway",
      text: "05:20 left work → 05:28 arrived home" },
  ]);
  const e = { h1: commute(), h2: commute() };
  if (day === 6) {
    e.h1.push({ minute: 600, end_minute: 640, kind: "park", text: "park 40 min" });
  }
  if (day === 13) {
    e.h2.push({ minute: 840, end_minute: 865, kind: "errand", text: "grocery 25 min" });
  }
  return e;
}

function usPersonLog() {
  const days = [];
  for (let day = 1; day <= 30; day += 1) {
    days.push({ day, entries: usEntries(day), summary: { h1: "", h2: "" } });
  }
  return { people: PEOPLE, days };
}

function usMoneyDoc() {
  return {
    currency: "USD",
    us_rent: true,
    labels: ["A", "B"],
    default_tenure: { A: "월세", B: "월세" },
    homes: {
      A: { label: "A", rent_usd_month: 4261, source: "Zillow ZORI (ZIP 추정)", estimate: true },
      B: { label: "B", rent_usd_month: 4678, source: "Zillow ZORI (ZIP 추정)", estimate: true },
    },
  };
}

function usSim() {
  return { status: "done", customId: "run-42j-us",
    labels: ["A", "B"], names: { A: "777 Hamilton", B: "205 Marshall Street" },
    start_date: "2026-11-02",
    compare: { days: 30, one_way: { A: 14, B: 19 } },
    moneyDoc: usMoneyDoc(),
    personLog: { A: usPersonLog(), B: usPersonLog() },
    lifeEvents: [], noCommute: false };
}

// Korean run: 07:45 commute to 강남 every workday, weekend park outings.
function krEntries(day) {
  const commute = () => ([
    { minute: 465, end_minute: 500, kind: "subway",
      text: "07:45 집에서 출발 → 08:20 회사 도착 (지하철 32분)" },
    { minute: 1080, end_minute: 1140, kind: "subway",
      text: "18:00 회사에서 나옴 → 19:00 집 도착" },
  ]);
  const e = { h1: commute(), h2: commute() };
  if (day === 6 || day === 13) {
    e.h2.push({ minute: 600, end_minute: 640, kind: "park", text: "공원 40분" });
  }
  return e;
}

function krPersonLog() {
  const days = [];
  for (let day = 1; day <= 30; day += 1) {
    days.push({ day, entries: krEntries(day), summary: { h1: "", h2: "" } });
  }
  return { people: PEOPLE, days };
}

function krMoneyDoc() {
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

function krSim() {
  return { status: "done", customId: "run-42j-kr",
    labels: ["A", "B"], names: { A: "역삼", B: "서현" },
    start_date: "2026-11-02", workplace: "강남",
    compare: { days: 30, one_way: { A: 37, B: 42 } },
    moneyDoc: krMoneyDoc(),
    personLog: { A: krPersonLog(), B: krPersonLog() },
    lifeEvents: [], noCommute: false };
}

function threadFor(sim) {
  return {
    messages: [{ role: "assistant", kind: "simulation", data: sim }],
    picks: ["h-a", "h-b"],
    candidates: [
      { id: "h-a", name: "home-a", scene: "area-a" },
      { id: "h-b", name: "home-b", scene: "area-b" },
    ],
  };
}

function answerUs(text, lang = "en") {
  const { messages, picks, candidates } = threadFor(usSim());
  return Chat.afterRunAnswer(text, { messages, picks, candidates, lang });
}

function answerKr(text, lang = "ko") {
  const { messages, picks, candidates } = threadFor(krSim());
  return Chat.afterRunAnswer(text, { messages, picks, candidates, lang });
}

const NO_HANGUL = /[가-힣]/;
const ROMANIZED = /Baeuja|\bNa\b/;

describe("42j English member labels (You / Your partner)", () => {
  it("partner question: Your partner + grammar, no romanization", () => {
    const r = answerUs("What did my partner do during the 30 days?");
    assert.ok(r && r.line, "reply");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(!ROMANIZED.test(r.line), r.line);
    assert.ok(r.line.includes("Your partner usually left around 08:00"), r.line);
    assert.ok(r.line.includes("was home around 17:28"), r.line);
  });

  it("me question: You, no romanization", () => {
    const r = answerUs("Tell me what I did during the 30 days?");
    assert.ok(r && r.line, "reply");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(!ROMANIZED.test(r.line), r.line);
    assert.ok(r.line.includes("You usually left around 08:00"), r.line);
    assert.ok(!r.line.includes("Your partner"), r.line);
  });

  it("weekend question: You / Your partner per person, no romanization", () => {
    const r = answerUs("What did you do on weekends?");
    assert.ok(r && r.line, "reply");
    assert.ok(!NO_HANGUL.test(r.line), r.line);
    assert.ok(!ROMANIZED.test(r.line), r.line);
    assert.ok(r.line.includes("Your partner") && r.line.includes("day 13"), r.line);
    assert.ok(r.line.includes("day 6"), r.line);
  });
});

describe("42j currency follows the home region", () => {
  it("US compare line: $ and no won", () => {
    const r = answerUs("Which one is better?");
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("$4,261") && r.line.includes("$4,678"), r.line);
    assert.ok(!/won|원/.test(r.line), r.line);
  });

  it("US compare line in Korean UI: $ and no 원", () => {
    const r = answerUs("둘 중 어디가 더 나아?", "ko");
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("$4,261"), r.line);
    assert.ok(!/원/.test(r.line), r.line);
  });

  it("US money chip: $ and no won", () => {
    const { messages, picks, candidates } = threadFor(usSim());
    const r = Chat.afterRunChipReply("How much a month?",
      { messages, picks, candidates, lang: "en" });
    assert.ok(r && r.line, "reply");
    assert.ok(r.line.includes("$4,261"), r.line);
    assert.ok(!/won|원/.test(r.line), r.line);
  });

  it("US run_summary: $ and no won (en), $ and no 원 (ko)", () => {
    const en = Chat.runSummaryFor(usSim(), "en");
    assert.ok(en.includes("$4,261"), en);
    assert.ok(!/won|원/.test(en), en);
    assert.ok(!NO_HANGUL.test(en), en);
    const ko = Chat.runSummaryFor(usSim(), "ko");
    assert.ok(ko.includes("$4,261"), ko);
    assert.ok(!/원/.test(ko), ko);
  });

  it("Korean run keeps 원", () => {
    const r = answerKr("둘 중 어디가 더 나아?");
    assert.ok(r.line.includes("원"), r.line);
    const s = Chat.runSummaryFor(krSim(), "ko");
    assert.ok(s.includes("원"), s);
  });
});

describe("42j English money intents answered from the run", () => {
  const QUESTIONS = [
    "How much do we pay a month?",
    "How much a month including utilities?",
    "What is the monthly cost?",
    "How much is the rent?",
    "What do we pay a month in total?",
  ];
  for (const q of QUESTIONS) {
    it(`${q}`, () => {
      const r = answerUs(q);
      assert.ok(r && r.line, "reply");
      assert.equal(r.tab, "money");
      assert.ok(r.line.includes("$4,261"), `rent: ${r.line}`);
      assert.ok(/total/i.test(r.line), `total: ${r.line}`);
      assert.ok(r.line.includes("Utilities"), `utilities: ${r.line}`);
      assert.ok(!/won|원/.test(r.line), r.line);
    });
  }

  it("Korean UI US money: rent + total + utilities note", () => {
    const r = answerUs("한 달에 내는 돈이 얼마야?", "ko");
    assert.equal(r.tab, "money");
    assert.ok(r.line.includes("$4,261"), r.line);
    assert.ok(r.line.includes("합계"), r.line);
    assert.ok(r.line.includes("유틸리티"), r.line);
  });

  it("unknown question still returns null", () => {
    assert.equal(answerUs("How is the weather tomorrow?"), null);
  });
});

describe("42j deposit question on US homes (no jeonse tab)", () => {
  it("English: monthly-rentals line, no tab", () => {
    const r = answerUs("What about the security deposit?");
    assert.ok(r && r.line, "reply");
    assert.ok(!r.tab, `no tab effect: ${r.tab}`);
    assert.ok(r.line.includes("monthly rentals"), r.line);
    assert.ok(r.line.includes("security deposit"), r.line);
  });

  it("Korean UI: 월세 line, no tab", () => {
    const r = answerUs("보증금은요?", "ko");
    assert.ok(r && r.line, "reply");
    assert.ok(!r.tab, `no tab effect: ${r.tab}`);
    assert.ok(r.line.includes("월세"), r.line);
  });

  it("Korean homes unchanged: jeonse tab", () => {
    const en = answerKr("What about jeonse?", "en");
    assert.equal(en.tab, "jeonse");
    const ko = answerKr("전세로 하면 어때?", "ko");
    assert.equal(ko.tab, "jeonse");
  });
});

describe("42j Show more homes rule path (US profile)", () => {
  it("English variants match, unrelated text does not", () => {
    for (const t of ["Show more homes", "Show me more candidates",
      "show 12 more homes.", "다른 후보 더 보여 줘"]) {
      assert.equal(Chat.isMoreCandidatesRequest(t), true, t);
    }
    assert.equal(Chat.isMoreCandidatesRequest("How is the weather tomorrow?"), false);
    assert.equal(Chat.isMoreCandidatesRequest("월세 낮은 순"), false);
  });

  it("stored US profile passes the re-run gate with US regions", () => {
    const profile = {
      currency: { value: "USD" },
      members: { value: [{ role: "self" }, { role: "spouse" }], source: "customer" },
      workplaces: { value: [{ member: 0, text: "Meta HQ",
        resolved: { place: { name: "Meta HQ" } } }], source: "customer" },
      monthlyMax: { value: 6000, source: "customer" },
      tenure: { value: "wolse", source: "customer" },
    };
    const hasValues = Engine.fieldRows(profile).some((r) => r.text !== "아직");
    assert.equal(hasValues, true);
    const regions = Engine.regionsForDoc({ profile, candidatesData: null });
    assert.ok(Array.isArray(regions) && regions.includes("us-menlo"), regions);
  });

  it("count line, never the fallback", () => {
    const line = Chat.moreCandidatesLine(12, "en");
    assert.ok(line.includes("12"), line);
    const { messages } = threadFor(usSim());
    assert.notEqual(line, Chat.localNoAnswerLine("Show more homes"));
    assert.notEqual(line, Chat.nonMuseNoReplyLine("Show more homes",
      { messages, lang: "en" }));
  });

  it("Show more homes is not an after-run answer (rule flow continues)", () => {
    assert.equal(answerUs("Show more homes"), null);
  });
});

describe("42j runSummaryFor carries pattern + weekend days", () => {
  it("Korean: 07:45 weekday pattern + 6일차(토) weekend outing", () => {
    const s = Chat.runSummaryFor(krSim(), "ko");
    assert.ok(s.includes("07:45"), s);
    assert.ok(s.includes("6일차(토)"), s);
    assert.ok(!s.includes("2일차"), s);
    assert.ok(Buffer.byteLength(s, "utf8") <= 3072, "3KB cap");
  });

  it("English: same data, translated member labels", () => {
    const s = Chat.runSummaryFor(krSim(), "en");
    assert.ok(s.includes("07:45"), s);
    assert.ok(s.includes("day 6 (Sat)"), s);
    assert.ok(!ROMANIZED.test(s), s);
    assert.ok(s.includes("Your partner usually left"), s);
    // Record quotes and card names stay as recorded; only member
    // labels translate, never romanize.
  });

  it("per-member lines for the US run", () => {
    const s = Chat.runSummaryFor(usSim(), "en");
    assert.ok(s.includes("Your partner usually left around 08:00"), s);
    assert.ok(s.includes("You usually left around 08:00"), s);
  });
});
