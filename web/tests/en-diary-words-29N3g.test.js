// 29N3g: the English diary never romanises activity words. The
// digest/record builders read English generic words from the one table
// (web/src/i18n/en-activity.js) when lang is "en"; proper names pass
// through and Korean output is byte-identical.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runDigest } from "../src/diary/digest.js";
import { slimRunForReport } from "../src/verify/compare.js";

const HANGUL = /[\uac00-\ud7a3]/;

function fixtureRun() {
  return {
    meta: { days: 30 },
    agents: [{ key: "h1", household: true, label: "나" }],
    trips: [{
      id: "t1", agent: "h1", day: 0, depart_min: 1000, arrive_min: 1030,
      minutes: 30, purpose: "park", mode: "walk", distance_m: 1500,
      from: { id: "home", label: "집", kind: "home" },
      to: { id: "p1", label: "공원", kind: "park" },
    }],
    aways: [
      { agent: "h1", day: 1, kind: "park", start_min: 1120, end_min: 1150, label: "공원" },
      { agent: "h1", day: 2, kind: "errand", start_min: 1120, end_min: 1150, label: "장보기" },
      { agent: "h1", day: 3, kind: "errand", start_min: 1120, end_min: 1150, label: "Main Street Market" },
    ],
    decisions: [],
  };
}

describe("29N3g english digest/record words", () => {
  it("runDigest in English reads groceries and park with no Hangul in those rows", () => {
    const digest = runDigest(fixtureRun(), "A", { lang: "en" });
    const evening = digest.facts.filter((f) => f.kind === "evening");
    assert.equal(evening.length, 3);
    const texts = evening.map((f) => f.text_ko).join("\n");
    assert.ok(texts.includes("groceries"), texts);
    assert.ok(texts.includes("park"), texts);
    for (const f of evening) assert.ok(!HANGUL.test(f.text_ko), f.text_ko);
  });

  it("slimRunForReport in English translates generic labels, keeps proper names", () => {
    const slim = slimRunForReport(fixtureRun(), { lang: "en" });
    const labels = slim.aways.map((a) => a.label);
    assert.ok(labels.includes("park"), labels.join(","));
    assert.ok(labels.includes("groceries"), labels.join(","));
    assert.ok(labels.includes("Main Street Market"), labels.join(","));
    assert.ok(!labels.some((l) => HANGUL.test(l)), labels.join(","));
    assert.equal(slim.trips[0].to.label, "park");
  });

  it("Korean output is byte-identical with and without lang", () => {
    const run = fixtureRun();
    assert.deepEqual(runDigest(run, "A", { lang: "ko" }), runDigest(run, "A"));
    assert.deepEqual(slimRunForReport(run, { lang: "ko" }), slimRunForReport(run));
  });

  it("ENGLISH_NOTE tells Muse never to romanise generic words", () => {
    const src = readFileSync(new URL("../src/consult/agent.js", import.meta.url), "utf8");
    assert.ok(src.includes("Never romanise a Korean generic word (장보기, 공원); use the English word."));
  });
});

// 29N3h: the English diary request sends an English digest — every fact
// kind has its English text built in code (times via hhmm, always HH:MM);
// Korean output is byte-identical.
function diaryFixtureRun() {
  return {
    meta: { days: 30 },
    agents: [{ key: "h1", household: true, label: "나" }],
    trips: [
      { id: "c1", agent: "h1", day: 0, depart_min: 480, arrive_min: 500,
        minutes: 20, purpose: "commute", mode: "walk", distance_m: 800,
        from: { id: "home", label: "집", kind: "home" },
        to: { id: "w1", label: "직장", kind: "work" } },
      { id: "late1", agent: "h1", day: 5, depart_min: 1300, arrive_min: 1335,
        minutes: 35, purpose: "home", mode: "walk", distance_m: 800,
        from: { id: "w1", label: "직장", kind: "work" },
        to: { id: "home", label: "집", kind: "home" } },
    ],
    aways: [
      { agent: "h1", day: 0, kind: "work", start_min: 517, end_min: 1000, label: "직장" },
      { agent: "h1", day: 10, kind: "park", start_min: 1161, end_min: 1191, label: "공원" },
    ],
    decisions: [],
  };
}

describe("29N3h english diary digest", () => {
  it("runDigest in English has no Hangul and HH:MM times", () => {
    const digest = runDigest(diaryFixtureRun(), "A", { lang: "en" });
    assert.equal(digest.facts.length, 3);
    for (const f of digest.facts) {
      assert.ok(!HANGUL.test(f.text_ko), f.text_ko);
      assert.match(f.text_ko, /\b\d{2}:\d{2}\b/, f.text_ko);
    }
    const byKind = Object.fromEntries(digest.facts.map((f) => [f.kind, f]));
    assert.equal(byKind.commute.text_ko, "day 1 commute 37 min (08:00 start)");
    assert.equal(byKind.evening.text_ko, "day 11 evening park 30 min (19:21 start)");
    assert.equal(byKind.late.text_ko, "day 6 return home 22:15 (late return)");
  });

  it("English facts keep id, day, minute and numbers", () => {
    const run = diaryFixtureRun();
    const en = runDigest(run, "A", { lang: "en" });
    const ko = runDigest(run, "A", { lang: "ko" });
    for (const kind of ["commute", "evening", "late"]) {
      const e = en.facts.find((f) => f.kind === kind);
      const k = ko.facts.find((f) => f.kind === kind);
      assert.equal(e.id, k.id);
      assert.equal(e.day, k.day);
      assert.equal(e.minute, k.minute);
      assert.deepEqual(e.numbers, k.numbers);
    }
  });

  it('lang "ko" output is unchanged', () => {
    const run = diaryFixtureRun();
    assert.deepEqual(runDigest(run, "A", { lang: "ko" }), runDigest(run, "A"));
  });

  it("chat.jsx passes lang to runDigest", () => {
    const src = readFileSync(new URL("../src/ui/chat.jsx", import.meta.url), "utf8");
    assert.ok(src.includes('runDigest(runs[l], l, { name: (payload.names || {})[l] || "", lang: currentLang() })'));
  });
});
