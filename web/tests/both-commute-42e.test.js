// Stage 42e — "둘 다 판교에서 일하는" means both commute; weekends come
// from the run calendar; the weekday pattern reads off the records;
// stay/money/crowding are answered with the numbers; a Muse fallback
// turn still shows a good rule answer. Pure, node --test.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let Chat;
let Profile;
let Simulate;
let Fixture;
let Agent;
let ScenarioCal;
before(async () => {
  Chat = await import("../src/ui/chat.jsx");
  Profile = await import("../src/profile.js");
  Simulate = await import("../src/engine/simulate.js");
  Fixture = await import("./engine-fixture.js");
  Agent = await import("../src/consult/agent.js");
  ScenarioCal = await import("../src/engine/scenario.js");
});

const KO = "판교에서 둘 다 일하는 예비부부예요. 연봉은 6천만 원, 5천만 원이고 모은 돈은 2억 원이에요. 7억 원 이하로 50㎡ 이상 집을 사고 싶어요.";
const EN = "We're an engaged couple, both working in Pangyo. Salaries 60M and 50M won a year, 200M won saved. We want to buy a 50sqm+ home under 700M won.";
const META = "My husband and I both work at Meta HQ. We want to rent near Menlo Park.";
const STATIONS = ["판교", "중앙", "서현"];

function tinyHomes() {
  return [
    { id: "h-a", name: "알파", scene: "tiny",
      station: { station: "중앙", walk_minutes: 5 }, lon: 127.0, lat: 37.5001 },
    { id: "h-b", name: "베타", scene: "tiny",
      station: { station: "중앙", walk_minutes: 5 }, lon: 127.003, lat: 37.5001 },
  ];
}

function scenarioWithRides(profile) {
  const sc = Profile.scenarioFromProfile(profile, tinyHomes(), {});
  sc.days = 7;
  sc.background = 0;
  for (const m of sc.household.members) {
    if (m.work && m.work.type === "station_ride") {
      m.work.ride_minutes = { A: 20, B: 20 };
      m.work.needs_user_input = false;
    }
  }
  return sc;
}

function workDays(run, agent) {
  return [...new Set(run.aways
    .filter((a) => a.agent === agent && a.kind === "work")
    .map((a) => a.day))].sort((a, b) => a - b);
}

describe("42e both adults commute (ko + en + Meta HQ)", () => {
  it("ko demo: two workplace entries, members 0 and 1, both 판교", () => {
    const r = Profile.extract_profile(KO, null, { stations: STATIONS });
    assert.deepEqual(Profile.guardProfileValues(r.profile, KO), []);
    const wps = r.profile.workplaces.value;
    assert.equal(wps.length, 2);
    assert.deepEqual(wps.map((w) => w.member).sort(), [0, 1]);
    for (const w of wps) assert.equal(w.resolved.station, "판교");
    assert.equal(r.profile.members.value.length, 2);
  });

  it("en demo: two workplace entries, both 판교", () => {
    const r = Profile.extract_profile(EN, null, { stations: STATIONS });
    const wps = r.profile.workplaces.value;
    assert.equal(wps.length, 2);
    assert.deepEqual(wps.map((w) => w.member).sort(), [0, 1]);
    for (const w of wps) assert.equal(w.resolved.station, "판교");
  });

  it("Meta HQ two adults: one entry per adult, same place", () => {
    const r = Profile.extract_profile(META, null, { stations: STATIONS });
    assert.equal(r.profile.members.value.length, 2);
    const wps = r.profile.workplaces.value;
    assert.equal(wps.length, 2);
    assert.deepEqual(wps.map((w) => w.member).sort(), [0, 1]);
    for (const w of wps) assert.ok(w.resolved.place, "place commute");
  });

  it("ko scenario: 나 + 배우자 both carry a 판교 commute block", () => {
    const r = Profile.extract_profile(KO, null, { stations: STATIONS });
    const sc = Profile.scenarioFromProfile(r.profile, tinyHomes(), {});
    assert.deepEqual(sc.household.members.map((m) => m.label), ["나", "배우자"]);
    for (const m of sc.household.members) {
      assert.equal(m.work.type, "station_ride");
      assert.equal(m.work.destination_station, "판교");
      assert.deepEqual(m.workdays, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    }
  });

  it("short engine run: h1 and h2 both have work aways Mon–Fri, none on weekend", () => {
    const r = Profile.extract_profile(KO, null, { stations: STATIONS });
    const run = Simulate.simulate(Fixture.tinyArea(), scenarioWithRides(r.profile), "A");
    assert.deepEqual(workDays(run, "h1"), [0, 1, 2, 3, 4]);
    assert.deepEqual(workDays(run, "h2"), [0, 1, 2, 3, 4]);
  });

  it("en scenario engine run: both commute Mon–Fri too", () => {
    const r = Profile.extract_profile(EN, null, { stations: STATIONS });
    const run = Simulate.simulate(Fixture.tinyArea(), scenarioWithRides(r.profile), "A");
    assert.deepEqual(workDays(run, "h1"), [0, 1, 2, 3, 4]);
    assert.deepEqual(workDays(run, "h2"), [0, 1, 2, 3, 4]);
  });
});

const PEOPLE = [
  { key: "h1", label: "나", role: "self" },
  { key: "h2", label: "배우자", role: "spouse" },
];

function commuteDay(day, dep, arr, home) {
  return [
    { minute: dep, end_minute: arr, kind: "subway",
      text: `${hh(dep)} 집에서 출발 → ${hh(arr)} 회사 도착 (지하철 32분, 서서 12분)` },
    { minute: 1080, end_minute: home, kind: "subway",
      text: `18:00 회사에서 나옴 → ${hh(home)} 집 도착` },
  ];
}
function hh(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function calendarLog() {
  const days = [];
  for (let day = 1; day <= 30; day += 1) {
    const entries = { h1: [], h2: [] };
    if (day === 1 || day === 3) entries.h1 = commuteDay(day, 457, 499, 1122);
    // Four weekday errands (Mon/Wed/Thu/Tue) + two weekday clinics.
    if (day === 1 || day === 3 || day === 4 || day === 9) {
      entries.h2.push({ minute: 1140, end_minute: 1165, kind: "errand",
        text: "19:00 장보기 25분" });
    }
    if (day === 5 || day === 8) {
      entries.h2.push({ minute: 600, end_minute: 630, kind: "other",
        text: "10:00 진료 30분" });
    }
    // Tuesday outing (day 2) vs Saturday outings (days 6, 13).
    if (day === 2) {
      entries.h2.push({ minute: 600, end_minute: 640, kind: "park",
        text: "공원 40분" });
    }
    if (day === 6 || day === 13) {
      entries.h2.push({ minute: 600, end_minute: 640, kind: "park",
        text: "공원 40분" });
    }
    days.push({ day, entries, summary: { h1: "", h2: "" } });
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

function simData() {
  return { status: "done", customId: "run-42e",
    labels: ["A", "B"], names: { A: "역삼", B: "서현" },
    start_date: "2026-11-02", workplace: "판교",
    compare: { days: 30, one_way: { A: 37, B: 42 },
      peak_congestion: { A: 120, B: 90 } },
    moneyDoc: moneyDoc(),
    personLog: { A: calendarLog(), B: calendarLog() },
    lifeEvents: [{ kind: "seated", a: { seated: 20, measured: 25 },
      b: { seated: 10, measured: 25 }, source: "실측 혼잡도" }],
    noCommute: false };
}

function thread() {
  const messages = [{ role: "assistant", kind: "simulation", data: simData() }];
  const picks = ["h-a", "h-b"];
  const candidates = [
    { id: "h-a", name: "역삼", scene: "area-a" },
    { id: "h-b", name: "서현", scene: "area-b" },
  ];
  return { messages, picks, candidates };
}

function answer(text, lang = "ko") {
  const { messages, picks, candidates } = thread();
  return Chat.afterRunAnswer(text, { messages, picks, candidates, lang });
}

describe("42e weekends come from the run calendar", () => {
  it("Monday start: days 6,7,13,14 are weekend, day 2 is a weekday", () => {
    assert.equal(Chat.simStartDate({}), "2026-11-02");
    assert.equal(Chat.simStartDate(simData()), "2026-11-02");
    const wd = (day) => ScenarioCal.WEEKDAYS[ScenarioCal.weekdayOf("2026-11-02", day - 1)];
    assert.deepEqual([6, 7, 13, 14].map(wd), ["Sat", "Sun", "Sat", "Sun"]);
    assert.equal(wd(2), "Tue");
    assert.equal(wd(1), "Mon");
  });

  it("주말 질문 names only weekend days (no Tuesday 2일차)", () => {
    const r = answer("주말에는 뭐 했어?");
    assert.ok(r.line.includes("6일차"), r.line);
    assert.ok(!r.line.includes("2일차"), r.line);
  });

  it("spouse outings list weekend days only", () => {
    const r = answer("배우자는 30일 동안 뭐 했어?");
    assert.ok(r.line.includes("6일차"), r.line);
    assert.ok(!r.line.includes("2일차"), r.line);
  });
});

describe("42e weekday pattern line reads off the records", () => {
  it("commuter: median leave / arrive / home clocks", () => {
    const r = answer("내가 뭘 했어?");
    assert.ok(r.line.includes(
      "평일에는 07:37쯤 나가서 판교 회사에 08:19쯤 도착하고, 18:42쯤 집에 왔어요."),
      r.line);
  });

  it("non-commuter: weekday errand + clinic counts", () => {
    const r = answer("배우자는 30일 동안 뭐 했어?");
    assert.ok(r.line.includes("평일에는 주로 집에 있었고, 장보기 4번·진료 2번 다녀왔어요."),
      r.line);
  });

  it("english commuter line quotes the same clocks, no Hangul", () => {
    const r = answer("Tell me what I did during the 30 days", "en");
    assert.ok(!/[가-힣]/.test(r.line), r.line);
    assert.ok(r.line.includes("07:37") && r.line.includes("08:19")
      && r.line.includes("18:42"), r.line);
  });
});

describe("42e crowding in the summary + the agent context", () => {
  it("runSummaryFor carries standing totals and peak congestion per home", () => {
    const s = Chat.runSummaryFor(simData());
    assert.ok(s.includes("합계 24분"), s);
    assert.ok(s.includes("혼잡 최대 120%"), s);
    assert.ok(s.includes("혼잡 최대 90%"), s);
  });

  it("agent context answers stay/money/crowding from the numbers, never the cards", () => {
    const line = Agent.formatAgentContext({ tab: "compare",
      run_summary: "A 역삼: 출근 편도 평균 37분." });
    assert.ok(line.includes("2~3문장"), line);
    assert.ok(line.includes("카드나 탭"), line);
  });

  it("peakCongestionByLabel reads the runs, null without numbers", () => {
    const runs = {
      A: { agents: [{ key: "h1", household: true }, { key: "b01", household: false }],
        totals: { per_member: {
          h1: { fatigue: { peak_congestion: { pct: 120 } } },
          b01: { fatigue: { peak_congestion: { pct: 200 } } } } } },
      B: { agents: [{ key: "h1", household: true }],
        totals: { per_member: { h1: { fatigue: null } } } },
    };
    assert.deepEqual(Chat.peakCongestionByLabel(runs), { A: 120, B: null });
  });
});

describe("42e a Muse fallback turn still shows the rule answer", () => {
  it("loan question: rule amounts, no inline mark (meta says it)", () => {
    const { messages, picks, candidates } = thread();
    const r = Chat.ruleAnswerForMuseFallback("대출은 얼마나 받아야 해?",
      { fallback: true }, { messages, picks, candidates, lang: "ko" });
    assert.ok(r, "rule answer");
    assert.equal(r.tab, "money");
    assert.ok(r.line.includes("8,000만"), r.line);
    assert.ok(!r.line.includes("(규칙으로 답했어요"), r.line);
    assert.ok(!r.line.includes("(answered by rules"), r.line);
  });

  it("no rule answer without a fallback, or without a rule match", () => {
    const { messages, picks, candidates } = thread();
    const ctx = { messages, picks, candidates, lang: "ko" };
    assert.equal(Chat.ruleAnswerForMuseFallback("대출은 얼마나 받아야 해?",
      { fallback: false }, ctx), null);
    assert.equal(Chat.ruleAnswerForMuseFallback("내일 날씨 어때?",
      { fallback: true }, ctx), null);
  });
});
