// Stage 42h — stay questions always end with the record's numbers;
// "N번 집이랑도 비교" is an action (pre-Muse); typed "more
// candidates" works without Muse; no inline rule mark. Pure,
// node --test.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => fs.readFileSync(path.join(here, p), "utf8");

let Chat;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
});

// Fixtures: same shape as after-run-questions-42d.test.js.
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
  return { status: "done", customId: "run-42h",
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

function thread(thirdName = "반포") {
  const messages = [{ role: "assistant", kind: "simulation", data: simData() }];
  const picks = ["h-a", "h-b"];
  const candidates = [
    { id: "h-a", name: "역삼", scene: "area-a" },
    { id: "h-b", name: "서현", scene: "area-b" },
    { id: "h-c", name: thirdName, scene: "area-c" },
  ];
  return { messages, picks, candidates };
}

function supplement(text, museText, opts, lang = "ko") {
  const { messages, picks, candidates } = opts || thread();
  return Chat.ruleAnswerForDigitlessMuse(text, museText,
    { messages, picks, candidates, lang });
}

const DIGITLESS_MONEY = "돈 화면에 두 집의 한 달 내역을 정리해 두었어요. 화면에서 함께 확인해 보시면 좋겠어요.";
const DIGITLESS_CROWD = "이번 대화에서 확인된 수치가 없어 말씀드리기 어려워요.";
const WITH_DIGITS = "한 달에 A는 68만원, B는 90만원이에요.";

describe("42h numbers always land after a Muse turn", () => {
  it("digitless Muse reply + money question → rule answer appended", () => {
    const r = supplement("관리비 포함하면 한 달에 얼마야?", DIGITLESS_MONEY, thread());
    assert.ok(r && r.line, "rule answer");
    assert.equal(r.tab, "money");
    assert.ok(/\d/.test(r.line), `numbers land: ${r.line}`);
    assert.ok(!r.line.includes("(규칙으로 답했어요"), r.line);
  });

  it("digitless Muse reply + crowding question → rule answer appended", () => {
    const r = supplement("출근 지하철 많이 붐벼?", DIGITLESS_CROWD, thread());
    assert.ok(r && r.line, "rule answer");
    assert.ok(r.line.includes("10분") || r.line.includes("서서"), r.line);
  });

  it("Muse reply with digits → nothing appended", () => {
    assert.equal(supplement("관리비 포함하면 한 달에 얼마야?", WITH_DIGITS, thread()), null);
    assert.equal(supplement("출근 지하철 많이 붐벼?", "서서 10분이에요.", thread()), null);
  });

  it("unrelated question → nothing appended", () => {
    assert.equal(supplement("내일 날씨 어때?", DIGITLESS_CROWD, thread()), null);
    assert.equal(supplement("다른 후보 더 보기", DIGITLESS_MONEY, thread()), null);
  });

  it("fallback helper carries no inline mark either (ko + en)", () => {
    const { messages, picks, candidates } = thread();
    const ko = Chat.ruleAnswerForMuseFallback("대출은 얼마나 받아야 해?",
      { fallback: true }, { messages, picks, candidates, lang: "ko" });
    assert.ok(ko && /\d/.test(ko.line), "ko rule answer");
    assert.ok(!ko.line.includes("(규칙으로 답했어요"), ko.line);
    const en = Chat.ruleAnswerForMuseFallback("대출은 얼마나 받아야 해?",
      { fallback: true }, { messages, picks, candidates, lang: "en" });
    assert.ok(en && en.line, "en rule answer");
    assert.ok(!en.line.includes("(answered by rules"), en.line);
  });
});

describe("42h compare-add is an action, handled pre-Muse", () => {
  it("3번 집이랑도 비교해 줘 → picks [A, B, #3], 3-id run, right line", () => {
    const { messages, picks, candidates } = thread();
    const r = Chat.preMuseCompareAdd("3번 집이랑도 비교해 줘",
      { messages, picks, candidates, lang: "ko" });
    assert.ok(r, "handled pre-Muse");
    assert.deepEqual(r.pick, ["h-a", "h-b", "h-c"]);
    assert.deepEqual(r.run, ["h-a", "h-b", "h-c"]);
    assert.ok(r.line.includes("반포를 담아"), r.line);
    assert.ok(r.line.includes("세 집으로 살아 볼게요"), r.line);
  });

  it("3번도 같이 살아 봐 줘 → same action, no-particle name form", () => {
    const { messages, picks, candidates } = thread("분당인텔리지2");
    const r = Chat.preMuseCompareAdd("3번도 같이 살아 봐 줘",
      { messages, picks, candidates, lang: "ko" });
    assert.ok(r, "handled pre-Muse");
    assert.deepEqual(r.pick, ["h-a", "h-b", "h-c"]);
    assert.deepEqual(r.run, ["h-a", "h-b", "h-c"]);
    assert.ok(r.line.includes("분당인텔리지2 담아"), r.line);
  });

  it("no run, or no compare-add → null (Muse path untouched)", () => {
    const t = thread();
    assert.equal(Chat.preMuseCompareAdd("3번 집이랑도 비교해 줘",
      { messages: [], picks: t.picks, candidates: t.candidates, lang: "ko" }), null);
    assert.equal(Chat.preMuseCompareAdd("관리비 포함하면 한 달에 얼마야?",
      { messages: t.messages, picks: t.picks, candidates: t.candidates, lang: "ko" }), null);
    assert.equal(Chat.preMuseCompareAdd("3번 담아 줘",
      { messages: t.messages, picks: t.picks, candidates: t.candidates, lang: "ko" }), null);
  });
});

describe("42h typed more-candidates without Muse", () => {
  it("all four variants match, others do not", () => {
    for (const t of ["다른 후보 더 보여 줘", "더 보여 줘", "다른 집 더", "show more homes", "Show More Homes"]) {
      assert.equal(Chat.isMoreCandidatesRequest(t), true, t);
    }
    for (const t of ["다른 후보 더 보기", "월세 낮은 순", "3번 담아 줘", "안녕하세요", ""]) {
      assert.equal(Chat.isMoreCandidatesRequest(t), false, t);
    }
  });

  it("typed variants stay on the rule path, never the Muse fallback", () => {
    for (const t of ["다른 후보 더 보여 줘", "더 보여 줘", "다른 집 더", "show more homes"]) {
      assert.equal(Chat.afterRunAnswer(t, { ...thread(), lang: "ko" }), null, t);
    }
    assert.notEqual(
      Chat.nonMuseNoReplyLine("다른 후보 더 보여 줘", { messages: [], lang: "ko" }),
      Chat.AFTER_RUN_MUSE_FALLBACK);
  });
});

describe("42h no inline rule mark anywhere", () => {
  it("chat.jsx carries no (규칙으로 답했어요 / (answered by rules", () => {
    const src = readSrc("../src/ui/chat.jsx");
    assert.ok(!src.includes("(규칙으로 답했어요"), "ko inline suffix gone");
    assert.ok(!src.includes("(answered by rules"), "en inline suffix gone");
  });

  it("sample rule answers carry numbers but no inline mark", () => {
    const texts = ["관리비 포함하면 한 달에 얼마야?", "출근 지하철 많이 붐벼?",
      "밤 10시 넘어서 집에 온 날 있어?", "둘 중 어디가 더 나아?",
      "B 집 출근길도 보여 줘", "배우자는 30일 동안 뭐 했어?",
      "주말에는 뭐 했어?", "대출은 얼마나 받아야 해?"];
    for (const text of texts) {
      const { messages, picks, candidates } = thread();
      const r = Chat.afterRunAnswer(text, { messages, picks, candidates, lang: "ko" });
      assert.ok(r && r.line, text);
      assert.ok(!r.line.includes("(규칙으로 답했어요"), text);
      assert.ok(!r.line.includes("(answered by rules"), text);
    }
  });
});
