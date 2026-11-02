// Stage 41b: Muse's English answers carry no Korean, no romanized
// one-off names and no "jeonse". node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ENGLISH_NOTE, englishNameSeeds, stampStationEn } from "../src/consult/agent.js";
import { cleanupEnglishAnswer, roundToolMinutes } from "../src/consult/guards.js";
import { matchesIgnoringSpaces, createSession, callTool } from "../src/consult/tools.js";
import { homeNameEn } from "../src/i18n/home-names.js";
import { reportDigest } from "../src/verify/compare.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GT = JSON.parse(readFileSync(
  join(HERE, "..", "..", "scenarios", "verify", "ground_truth.json"), "utf-8"));

const KO_HOME = "강남구청역에스케이허브블루";
const SPACED_HOME = "강남구청역 에스케이 허브 블루";

describe("41b ENGLISH_NOTE", () => {
  it("has no Korean-once-in-parentheses rule and names deposit lease", () => {
    assert.ok(!ENGLISH_NOTE.includes("with the Korean once in parentheses"));
    assert.ok(!ENGLISH_NOTE.includes("Korean once in parentheses"));
    assert.ok(ENGLISH_NOTE.includes("deposit lease"));
    assert.ok(!ENGLISH_NOTE.includes("₩260M"));
  });
});

describe("41b cleanupEnglishAnswer", () => {
  it("strips a Hangul parenthetical", () => {
    assert.equal(
      cleanupEnglishAnswer("near Sangwangsimni Stn (상왕십리역) at 24 min", { lang: "en" }),
      "near Sangwangsimni Stn at 24 min");
  });
  it("writes deposit lease and monthly rent", () => {
    assert.equal(
      cleanupEnglishAnswer("I found 5,630 jeonse homes here.", { lang: "en" }),
      "I found 5,630 deposit lease homes here.");
    assert.equal(
      cleanupEnglishAnswer("Jeonse has no rent.", { lang: "en" }),
      "Deposit lease has no rent.");
  });
  it("writes won as full digits plus won", () => {
    assert.equal(
      cleanupEnglishAnswer("was 150,000원.", { lang: "en" }),
      "was 150,000 won.");
    assert.equal(
      cleanupEnglishAnswer("deposit of ₩260M", { lang: "en" }),
      "deposit of 260,000,000 won");
  });
  it("returns a Korean answer unchanged", () => {
    const ko = "상왕십리역 근처에서 전세 5,630곳을 찾았어요. 보증금은 150,000원이에요.";
    assert.equal(cleanupEnglishAnswer(ko, { lang: "ko" }), ko);
  });
});

describe("41b deterministic English home names", () => {
  it("name_en equals homeNameEn with no naming call", () => {
    // englishNameSeeds is pure: no provider, no naming call.
    const seeds = englishNameSeeds({ candidates: [{ name: KO_HOME }] });
    assert.equal(seeds[KO_HOME], homeNameEn(KO_HOME));
    assert.ok(!/[가-힣]/.test(seeds[KO_HOME]));
  });
  it("stamps station_en next to a Korean station field", () => {
    const row = { station: "상왕십리" };
    stampStationEn(row);
    assert.equal(typeof row.station_en, "string");
    assert.ok(!/[가-힣]/.test(row.station_en));
  });
});

describe("41b complex lookup ignores spaces", () => {
  it("a spaced name finds the stored spaceless complex", async () => {
    assert.equal(matchesIgnoringSpaces([KO_HOME], SPACED_HOME), true);
    const area = {
      ...tinyArea(),
      complexes: [{ id: "cx9", name: KO_HOME, name_source: "register",
        building_ids: [], centroid: [127.0, 37.5001],
        households_hint: null, max_floors: 10 }],
    };
    const s = createSession({
      scenario: tinyScenario({ days: 2, background: 0, seed: 7,
        homes: [{ label: "A", area: "pangyo", complex_name: "알파" }] }),
      loadArea: async () => area,
    });
    const r = await callTool(s, "update_scenario", {
      homes: [{ label: "A", area: "pangyo", complex_name: SPACED_HOME }],
    });
    assert.equal(r.ok, true);
  });
});

describe("41b minute values reach the model rounded", () => {
  it("963.5999999999996 reads as 963.6", () => {
    const out = roundToolMinutes({ ok: true,
      rides: [{ minutesTotal: 963.5999999999996, minutes: 24 }] });
    assert.equal(out.rides[0].minutesTotal, 963.6);
    assert.equal(out.rides[0].minutes, 24);
  });
});

describe("41b compare.js deposit-lease meaning", () => {
  it("English meaning says deposit lease, never jeonse", () => {
    const digest = reportDigest({
      runs: { A: { meta: {}, agents: [{ key: "h1", household: true }],
        trips: [], aways: [], decisions: [] } },
      labels: ["A"],
      homes: { A: { tenure: "jeonse", maintenance_won_month: 383334 } },
      persona: "newlywed_couple",
      groundTruth: GT,
    });
    const v = digest.items.find((it) => it.id === "C02").values.A;
    assert.ok(v.meaning_en.includes("deposit lease"));
    assert.ok(!v.meaning_en.includes("jeonse"));
  });
});
