// Stage 42f — after a done run, unknown text reaches the rule flow
// (afterRunAnswer returns null; the Muse fallback lives only in the
// non-Muse turn guard), and the key-field save button keeps its full
// label. Pure + static checks (node --test).
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

const BATTERY_42D = [
  "배우자는 30일 동안 뭐 했어?",
  "밤 10시 넘어서 집에 온 날 있어?",
  "B 집 출근길도 보여 줘",
  "출근 지하철 많이 붐벼?",
  "둘 중 어디가 더 나아?",
  "대출은 얼마나 받아야 해?",
  "전세로 하면 어때?",
  "주말에는 뭐 했어?",
  "근처에 공원이나 마트 있어?",
  "아이 생기면 학교는 가까워?",
  "3번 집이랑도 비교해 줘",
  "관리비 포함하면 한 달에 얼마야?",
];

describe("42f after-run passthrough: unknown text returns null", () => {
  it("rule-flow texts are not after-run answers (Korean)", () => {
    for (const text of ["다른 후보 더 보기", "강남으로 다시 찾아 줘", "월세 낮은 순", "3번 담아 줘"]) {
      assert.equal(answer(text, thread()), null, text);
    }
  });

  it("rule-flow texts are not after-run answers (English)", () => {
    assert.equal(answer("Show more homes", thread(), "en"), null);
    assert.equal(answer("How is the weather tomorrow?", thread(), "en"), null);
  });

  it("never the Muse fallback line for rule-flow text", () => {
    for (const text of ["다른 후보 더 보기", "강남으로 다시 찾아 줘", "월세 낮은 순"]) {
      const r = answer(text, thread());
      assert.ok(!r || r.line !== Chat.AFTER_RUN_MUSE_FALLBACK, text);
    }
  });

  it("전세 점검 keeps its jeonse-tab rule answer (battery branch, not the fallback)", () => {
    // Same JEONSE branch as battery Q7: a real rule reply (tab + line),
    // so the send path answers from rules instead of the Muse fallback.
    const r = answer("전세 점검", thread());
    assert.equal(r && r.tab, "jeonse");
    assert.ok(r.line && r.line !== Chat.AFTER_RUN_MUSE_FALLBACK, r.line);
  });

  it("still answers all 12 battery questions", () => {
    for (const text of BATTERY_42D) {
      const r = answer(text, thread());
      assert.ok(r && r.line, text);
    }
  });
});

describe("42f non-Muse turn guard: fallback only when nothing visible", () => {
  it("rule flow replied → answered, so the guard pushes nothing", () => {
    assert.equal(Chat.answeredSince(2, 1), true);
    assert.equal(Chat.countsAsVisibleReply(
      { role: "assistant", kind: "text", content: "x" }), true);
  });

  it("nothing visible after a done run → the Muse fallback line", () => {
    const { messages } = thread();
    assert.equal(Chat.nonMuseNoReplyLine("다른 후보 더 보기", { messages, lang: "ko" }),
      Chat.AFTER_RUN_MUSE_FALLBACK);
    assert.equal(Chat.nonMuseNoReplyLine("Show more homes", { messages, lang: "en" }),
      Chat.AFTER_RUN_MUSE_FALLBACK_EN);
  });

  it("nothing visible with no run → the generic rule line", () => {
    const text = "다른 후보 더 보기";
    assert.equal(Chat.nonMuseNoReplyLine(text, { messages: [], lang: "ko" }),
      Chat.localNoAnswerLine(text));
  });

  it("send wires the guard to the rule flow (static)", () => {
    const src = readSrc("../src/ui/chat.jsx");
    assert.ok(src.includes("nonMuseNoReplyLine(content,"), "guard uses the 42f line");
    assert.ok(src.includes("await structuredFlow(content);"), "rule flow runs");
    assert.ok(/if \(!answered\) \{\s*pushMsg/.test(src), "guard pushes only when silent");
  });
});

describe("42f key field: save button keeps its full label", () => {
  it("button label is present in full in the alert markup", () => {
    const src = readSrc("../src/ui/chat.jsx");
    assert.ok(src.includes('label="키 저장"'), "full label, never cut");
    assert.ok(src.includes('wrap="wrap" className="ui-noanswer-keyrow"'),
      "key row wraps instead of shrinking the button");
  });

  it("key-row CSS never truncates: no ellipsis, button never shrinks", () => {
    const css = readSrc("../src/ui/ui.css");
    const rows = css.split("\n").filter((l) => l.includes("noanswer-keyrow"));
    assert.ok(rows.length >= 3, `key-row rules: ${rows.length}`);
    assert.ok(rows.every((l) => !l.includes("ellipsis")), "no ellipsis style");
    assert.ok(rows.every((l) => !l.includes("text-overflow")), "no text-overflow");
    assert.ok(rows.some((l) => l.includes("flex-wrap: wrap")), "wraps under the input");
    assert.ok(rows.some((l) => l.includes("flex: none")), "button keeps full width");
  });
});
