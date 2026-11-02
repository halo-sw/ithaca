// 42c: every 30-day run keeps a per-person log — pure builder,
// payload ride-along, chat 30일 기록 section, sim 기록 panel.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let personMonthLog;
let homePersonLogs;
let getDayPersonEntries;
let currentEntryIndex;
before(async () => {
  ({ personMonthLog, homePersonLogs, getDayPersonEntries, currentEntryIndex } =
    await import("../src/diary/person-log.js"));
});

function runKo() {
  return {
    agents: [
      { key: "h1", label: "나", role: "self", household: true },
      { key: "h2", label: "배우자", role: "adult", household: true },
      { key: "b1", label: "이웃", role: "adult", household: false, background: true },
    ],
    aways: [
      { agent: "h1", day: 1, kind: "ride", start_min: 464, end_min: 496,
        label: "지하철 이동", detail: { direction: "out", ride_minutes: 32, ride: { minutesTotal: 32, crowdedMin: 12 } } },
      { agent: "h1", day: 1, kind: "work", start_min: 499, end_min: 1080,
        label: "판교역 근무",
        detail: { rides: { out: { minutesTotal: 32, crowdedMin: 12 }, back: { minutesTotal: 30 } } } },
      { agent: "h1", day: 1, kind: "ride", start_min: 1080, end_min: 1110,
        label: "지하철 이동", detail: { direction: "back", ride_minutes: 30, ride: { minutesTotal: 30 } } },
      { agent: "h1", day: 1, kind: "errand", start_min: 1150, end_min: 1175,
        label: "마트 장보기", detail: { shop_category: "supermarket" } },
      { agent: "h2", day: 1, kind: "park", start_min: 600, end_min: 640, label: "공원 산책" },
      { agent: "b1", day: 1, kind: "work", start_min: 500, end_min: 1000, label: "배경 근무" },
      { agent: "h1", day: 2, kind: "ride", start_min: 447, end_min: 479,
        label: "지하철 이동", detail: { direction: "out", ride_minutes: 32, ride: { minutesTotal: 32 } } },
      { agent: "h1", day: 2, kind: "work", start_min: 500, end_min: 1200,
        label: "판교역 근무",
        detail: { rides: { out: { minutesTotal: 32 }, back: { minutesTotal: 30 } } } },
      { agent: "h1", day: 2, kind: "ride", start_min: 1200, end_min: 1230,
        label: "지하철 이동", detail: { direction: "back", ride_minutes: 30, ride: { minutesTotal: 30 } } },
    ],
    trips: [
      { agent: "h1", day: 1, depart_min: 457, arrive_min: 464, minutes: 7, purpose: "commute" },
      { agent: "h1", day: 1, depart_min: 1110, arrive_min: 1122, minutes: 12, purpose: "commute" },
      { agent: "h1", day: 1, depart_min: 1144, arrive_min: 1150, minutes: 6, purpose: "errand" },
      { agent: "h1", day: 1, depart_min: 1175, arrive_min: 1181, minutes: 6, purpose: "errand" },
      { agent: "h1", day: 2, depart_min: 1320, arrive_min: 1334, minutes: 14, purpose: "commute" },
    ],
  };
}

describe("42c personMonthLog entries", () => {
  it("builds exact entry texts in minute order with day summaries", () => {
    const log = personMonthLog(runKo());
    assert.deepEqual(log.people, [
      { key: "h1", label: "나", role: "self" },
      { key: "h2", label: "배우자", role: "adult" },
    ]);
    const d1 = log.days.find((d) => d.day === 1);
    assert.deepEqual(d1.entries.h1, [
      { minute: 457, end_minute: 499, kind: "subway",
        text: "07:37 집에서 출발 → 08:19 회사 도착 (지하철 32분, 서서 12분)" },
      { minute: 1080, end_minute: 1122, kind: "subway",
        text: "18:00 회사에서 나옴 → 18:42 집 도착" },
      { minute: 1150, end_minute: 1175, kind: "errand",
        text: "19:10 장보기 25분 (마트까지 걸어서 6분)" },
    ]);
    assert.equal(d1.summary.h1, "출근 7분 · 18:42 귀가 · 장보기");
    assert.deepEqual(d1.entries.h2, [
      { minute: 600, end_minute: 640, kind: "park", text: "공원 40분" },
    ]);
    assert.equal(d1.summary.h2, "공원");
    const d2 = log.days.find((d) => d.day === 2);
    assert.deepEqual(d2.entries.h1, [
      { minute: 447, end_minute: 500, kind: "subway",
        text: "07:27 집에서 출발 → 08:20 회사 도착 (지하철 32분)" },
      { minute: 1334, end_minute: null, kind: "home", text: "22:14 늦은 귀가" },
    ]);
    assert.equal(d2.summary.h1, "출근 · 늦은 귀가");
    const d3 = log.days.find((d) => d.day === 3);
    assert.deepEqual(d3.entries.h1, []);
    assert.deepEqual(d3.entries.h2, []);
    assert.equal(d3.summary.h1, "");
    assert.equal(log.days.length, 30);
  });

  it("every number in every entry text comes from the source record", () => {
    const run = runKo();
    const clocks = new Set();
    const fields = new Set();
    for (const t of run.trips) {
      clocks.add(t.depart_min); clocks.add(t.arrive_min); fields.add(t.minutes);
    }
    for (const a of run.aways) {
      clocks.add(a.start_min); clocks.add(a.end_min);
      const r = a.detail?.ride || a.detail?.rides?.out;
      for (const v of [a.detail?.ride_minutes, r?.minutesTotal, r?.crowdedMin]) {
        if (Number.isFinite(v)) fields.add(v);
      }
    }
    for (const lang of ["ko", "en"]) {
      const log = personMonthLog(run, { lang });
      for (const d of log.days) {
        for (const list of Object.values(d.entries)) {
          for (const e of list) {
            for (const m of e.text.matchAll(/(\d{2}):(\d{2})/g)) {
              const clock = Number(m[1]) * 60 + Number(m[2]);
              assert.ok(clocks.has(clock), `${lang} clock ${m[0]} not in record: ${e.text}`);
            }
            const durRe = lang === "en" ? /(\d+) min/g : /(\d+)분/g;
            for (const m of e.text.matchAll(durRe)) {
              const n = Number(m[1]);
              const derived = [...clocks].some((a) => [...clocks].some((b) => Math.abs(a - b) === n));
              assert.ok(fields.has(n) || derived,
                `${lang} duration ${n} not in record: ${e.text}`);
            }
          }
        }
      }
    }
  });

  it("lang en carries no Hangul", () => {
    const log = personMonthLog(runKo(), { lang: "en" });
    const texts = [];
    for (const d of log.days) {
      for (const k of Object.keys(d.entries)) {
        texts.push(...d.entries[k].map((e) => e.text), d.summary[k]);
      }
    }
    assert.ok(texts.length > 0);
    for (const t of texts) assert.ok(!/[가-힣]/.test(t), `Hangul in en text: ${t}`);
    const d1 = log.days.find((d) => d.day === 1);
    assert.equal(d1.entries.h1[0].text, "07:37 left home → 08:19 arrived at work (subway 32 min, standing 12 min)");
    assert.equal(d1.entries.h1[2].text, "19:10 groceries 25 min (walk 6 min to store)");
  });
});

describe("42c homePersonLogs payload", () => {
  it("keeps one compact log per home with no detail objects", () => {
    const runs = { A: runKo(), B: runKo() };
    const out = homePersonLogs(runs, ["A", "B"]);
    assert.deepEqual(Object.keys(out), ["A", "B"]);
    const raw = JSON.stringify(out);
    assert.ok(!raw.includes("detail"), "no detail objects ride along");
    assert.ok(raw.includes("07:37 집에서 출발"), "entry text kept");
    assert.equal(out.A.people.length, 2);
  });
});

describe("42c chat 30일 기록 section (SSR)", () => {
  let React;
  let renderToStaticMarkup;
  let PersonLogSection;
  let personMomentUrl;
  let simMomentUrl;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ PersonLogSection, personMomentUrl } = await import("../src/ui/chat.jsx"));
    ({ simMomentUrl } = await import("../src/chat/urls.js"));
  });

  function sectionHtml() {
    const log = personMonthLog(runKo());
    return renderToStaticMarkup(React.createElement(PersonLogSection,
      { personLog: { A: log }, labels: ["A"], customId: "c9", onScene: () => {} }));
  }

  it("is collapsed by default with home/person tabs and day rows", () => {
    const html = sectionHtml();
    assert.ok(html.includes("30일 기록"), "section header");
    const sect = html.match(/<details[^>]*data-testid="section-personlog"[^>]*>/);
    assert.ok(sect && !sect[0].includes("open"), "collapsed by default");
    assert.ok(html.includes("나") && html.includes("배우자"), "person tabs from labels");
    assert.ok(html.includes("1일차 · 출근 7분 · 18:42 귀가 · 장보기"), "day row with summary");
    assert.ok(html.includes("3일차 · 기록 없음"), "empty day reads 기록 없음");
  });

  it("a day holds its entries with › links", () => {
    const html = sectionHtml();
    const day1 = html.split('personlog-day-"')[0];
    const part = html.split("personlog-day-1")[1].split("personlog-day-2")[0];
    assert.ok(part.includes("07:37 집에서 출발 → 08:19 회사 도착"), "expanding the day shows its entries");
    assert.ok(part.includes("›"), "each entry has a › opener");
    assert.ok(day1.length > 0);
  });

  it("the › opens the expected simMomentUrl", () => {
    assert.equal(personMomentUrl({ custom: "c9", home: "A", day: 1, minute: 457, follow: 1 }),
      simMomentUrl({ custom: "c9", home: "A", day: 1, t: "07:37", follow: 1, embed: true }));
    assert.equal(personMomentUrl({ custom: "c9", home: "A", day: 2, minute: 1334, follow: 1 }),
      simMomentUrl({ custom: "c9", home: "A", day: 2, t: "22:14", follow: 1, embed: true }));
  });
});

describe("42c sim 기록 panel helpers (SSR)", () => {
  let React;
  let renderToStaticMarkup;
  let RecordPanel;
  let recordPersonKey;
  before(async () => {
    React = (await import("react")).default;
    ({ renderToStaticMarkup } = await import("react-dom/server"));
    ({ RecordPanel, recordPersonKey } = await import("../src/ui/timeline.jsx"));
  });

  it("entries for (day, person) and the highlighted index for a minute", () => {
    const log = personMonthLog(runKo());
    assert.equal(getDayPersonEntries(log, 1, "h1").length, 3);
    assert.deepEqual(getDayPersonEntries(log, 3, "h1"), []);
    const entries = getDayPersonEntries(log, 1, "h1");
    assert.equal(currentEntryIndex(entries, 480), 0);
    assert.equal(currentEntryIndex(entries, 1100), 1);
    assert.equal(currentEntryIndex(entries, 1160), 2);
    assert.equal(currentEntryIndex(entries, 100), -1);
    assert.equal(recordPersonKey({ personLog: log, follow: 2 }), "h2");
    assert.equal(recordPersonKey({ personLog: log, follow: 0 }), "h1");
  });

  it("the panel highlights the current entry as the clock moves", () => {
    const log = personMonthLog(runKo());
    const html = renderToStaticMarkup(React.createElement(RecordPanel,
      { log, day: 1, personKey: "h1", minute: 1100, onJump: () => {} }));
    assert.ok(html.includes("record-panel"), "panel renders");
    assert.ok(html.includes("18:00 회사에서 나옴 → 18:42 집 도착"), "entries listed");
    const now = html.match(/<button[^>]*ui-record-now[^>]*aria-label="([^"]*)"/);
    assert.ok(now && now[1].startsWith("18:00"), "the current entry is highlighted");
  });
});
