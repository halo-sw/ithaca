// Stage 34b — English report member names (me/spouse/…) and one
// name form in the result header. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./jsx-loader.mjs", import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

let React;
let renderToString;
let ResultSummary;
let trayDisplayName;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ ResultSummary, trayDisplayName } = await import("../src/ui/chat.jsx"));
});

const { memberLabelFor, memberLabelForLang, memberLabelEn } =
  await import("../src/profile.js");
const { loadGroundTruth } = await import("../src/verify/checklist.js");
const { reportDigest } = await import("../src/verify/compare.js");
const { checkNumberClaims, engineValue, memberKeyFor } =
  await import("../src/verify/numbers.js");

function enRun() {
  const leg = (id, agent, day, minutes, depart_min, back) => ({
    id, agent, day, purpose: "commute", minutes, depart_min,
    from: back ? { kind: "work", label: "일터" } : { kind: "home", label: "집" },
    to: back ? { kind: "home", label: "집" } : { kind: "work", label: "일터" },
  });
  return {
    meta: { start_date: "2026-11-01", area: "seoul-x" },
    agents: [
      { key: "h1", id: "m1", label: "나", household: true },
      { key: "h2", id: "m2", label: "배우자", household: true },
    ],
    trips: [
      leg("c-am1", "h1", 0, 2, 480, false),
      leg("c-pm1", "h1", 0, 4, 1080, true),
      leg("c-am2", "h2", 0, 30, 480, false),
      leg("c-pm2", "h2", 0, 30, 1080, true),
    ],
    aways: [],
    decisions: [],
  };
}

const HOME = { monthly_won: 500000, maintenance_won_month: 100000,
  utilities_won_month: 50000 };
const PERSONA = "newlywed_couple";

describe("34b English member labels", () => {
  it("maps 나/배우자/아이/함께 사는 사람 3 to me/spouse/child/housemate 3", () => {
    assert.equal(memberLabelEn("나"), "me");
    assert.equal(memberLabelEn("배우자"), "spouse");
    assert.equal(memberLabelEn("아이"), "child");
    assert.equal(memberLabelEn("함께 사는 사람 3"), "housemate 3");
    assert.equal(memberLabelForLang({ role: "adult" }, 2, "en"), "housemate 3");
    assert.equal(memberLabelForLang({ role: "self" }, 0, "en"), "me");
  });

  it("a custom label passes through; Korean returns the old label", () => {
    assert.equal(memberLabelForLang({ label: "Alex", role: "adult" }, 0, "en"), "Alex");
    assert.equal(memberLabelEn("Alex"), "Alex");
    assert.equal(memberLabelForLang({ role: "adult" }, 1, "ko"), "배우자");
    assert.equal(memberLabelForLang({ role: "adult" }, 1, "ko"),
      memberLabelFor({ role: "adult" }, 1));
    assert.equal(memberLabelFor({ role: "self" }, 0), "나");
  });
});

describe("34b report input carries English member labels", () => {
  it("English digest N01 has no Hangul member label; Korean is unchanged", () => {
    const base = { runs: { A: enRun() }, labels: ["A"],
      homes: { A: HOME }, persona: PERSONA, groundTruth: GT };
    const en = reportDigest({ ...base, lang: "en" });
    const n01en = en.items.find((it) => it.id === "N01");
    assert.equal(n01en.values.A.h1.label_ko, "me");
    assert.equal(n01en.values.A.h2.label_ko, "spouse");
    for (const v of Object.values(n01en.values.A)) {
      assert.ok(!/[가-힣]/.test(v.label_ko || ""),
        `no Hangul member label, got ${v.label_ko}`);
    }
    const ko = reportDigest(base);
    const n01ko = ko.items.find((it) => it.id === "N01");
    assert.equal(n01ko.values.A.h1.label_ko, "나");
    assert.equal(n01ko.values.A.h2.label_ko, "배우자");
  });
});

describe("34b number check maps me back to 나", () => {
  it("me resolves to h1 and checks against 나's trips", () => {
    const run = enRun();
    assert.equal(memberKeyFor(run, "me"), "h1");
    assert.deepEqual(engineValue("N01", run, { member: "me" }),
      engineValue("N01", run, { member: "나" }));
  });

  it("passes with 5, fails with 9", () => {
    const loaded = loadGroundTruth(GT, PERSONA);
    const sentence = (value) => ({ persona: PERSONA, home: HOME, sentences: [{
      id: "s1", item_id: "N01", text_ko: "me averaged 5 min one-way",
      claims: [{ field: "minutes", value, unit: "분", member: "me" }],
      evidence: [] }] });
    assert.equal(checkNumberClaims(sentence(5), enRun(), loaded).failures.length, 0);
    assert.equal(checkNumberClaims(sentence(9), enRun(), loaded).failures.length, 1);
  });
});

describe("34b result header shows one name form", () => {
  const names = {
    A: "강남역 센트럴 푸르지오 시티 (Gangnam Stn Senteureol Pureujio Siti)",
    B: "목화밀라트 (Mokhwamillateu)",
  };
  const data = { labels: ["A", "B"], names,
    compare: { days: 30, metrics: [], members: [], one_way: { A: 5, B: 9 } },
    moneyMissing: "" };

  it("trayDisplayName splits the Korean (English) form", () => {
    assert.equal(trayDisplayName(names.A, "en"), "Gangnam Stn Senteureol Pureujio Siti");
    assert.equal(trayDisplayName(names.A, "ko"), "강남역 센트럴 푸르지오 시티");
    assert.equal(trayDisplayName(names.B, "en"), "Mokhwamillateu");
  });

  it("English header shows the English form only", () => {
    const html = renderToString(
      React.createElement(ResultSummary, { data, lang: "en" }));
    assert.ok(html.includes("Gangnam Stn Senteureol Pureujio Siti"));
    assert.ok(html.includes("Mokhwamillateu"));
    assert.ok(!html.includes("강남역"), "no Korean form in English header");
    assert.ok(!html.includes("목화밀라트"), "no Korean form in English header");
  });

  it("Korean header shows the Korean form only", () => {
    const html = renderToString(
      React.createElement(ResultSummary, { data, lang: "ko" }));
    assert.ok(html.includes("강남역 센트럴 푸르지오 시티"));
    assert.ok(html.includes("목화밀라트"));
    assert.ok(!html.includes("Gangnam Stn"), "no English form in Korean header");
    assert.ok(!html.includes("Mokhwamillateu"), "no English form in Korean header");
  });
});
