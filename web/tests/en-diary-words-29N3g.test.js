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
