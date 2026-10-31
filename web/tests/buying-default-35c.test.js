// Stage 35c — buying (매매) is the default everywhere a Korean search starts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);
import {
  emptyProfile, extract_profile, missingQuestions,
} from "../src/profile.js";
import { FILTER_TENURES } from "../src/ui/map-filters.js";
import { SYSTEM_PROMPT, ENGLISH_NOTE } from "../src/consult/agent.js";

const STATIONS = ["강남", "판교", "잠실", "미금", "정자", "서현", "수내", "모란"];

describe("35c default tenure is buying (매매)", () => {
  it("매매 sentence gives trade + priceMax + cash", () => {
    const { profile, ok, errors } = extract_profile(
      "강남 출근, 모은 돈 3억, 9억 이하 매매", null, { stations: STATIONS });
    assert.equal(ok, true, JSON.stringify(errors));
    assert.equal(profile.tenure.value, "trade");
    assert.equal(profile.priceMax.value, 900000000);
    assert.equal(profile.cash.value, 300000000);
  });

  it("no tenure word gives trade with source default", () => {
    const { profile } = extract_profile("강남 출근 둘이", null, { stations: STATIONS });
    assert.equal(profile.tenure.value, "trade");
    assert.equal(profile.tenure.source, "default");
  });

  it("a later tenure word wins over the default", () => {
    const first = extract_profile("강남 출근 둘이", null, { stations: STATIONS });
    assert.equal(first.profile.tenure.source, "default");
    const second = extract_profile("전세 4억 이하", first.profile, { stations: STATIONS });
    assert.equal(second.profile.tenure.value, "jeonse");
    assert.equal(second.profile.tenure.source, "customer");
  });

  it("전세 still gives jeonse + depositMax", () => {
    const { profile } = extract_profile("전세 4억 이하", null, { stations: STATIONS });
    assert.equal(profile.tenure.value, "jeonse");
    assert.equal(profile.depositMax.value, 400000000);
  });

  it("US stays rent-only", () => {
    const { profile } = extract_profile(
      "I work at Meta HQ, renting up to $5,000", null, { stations: STATIONS });
    assert.equal(profile.currency.value, "USD");
    assert.equal(profile.tenure.value, "wolse");
  });
});

describe("35c missingQuestions asks buying budget, never tenure", () => {
  it("KRW profile with no tenure asks priceMax and cash", () => {
    const fields = missingQuestions(emptyProfile()).map((q) => q.field);
    assert.ok(fields.includes("priceMax"), "priceMax");
    assert.ok(fields.includes("cash"), "cash");
    assert.ok(!fields.includes("tenure"), "no tenure question");
  });
});

describe("35c starting prompts parse into buying profiles", () => {
  it("every EXAMPLE_PROMPTS entry except us-meta parses to trade with a priceMax", async () => {
    const { EXAMPLE_PROMPTS } = await import("../src/ui/landing.jsx");
    for (const p of EXAMPLE_PROMPTS) {
      if (p.id === "us-meta") continue;
      const { profile, ok, errors } = extract_profile(p.prompt, null, { stations: STATIONS });
      assert.equal(ok, true, `${p.id}: ${JSON.stringify(errors)}`);
      assert.equal(profile.tenure.value, "trade", p.id);
      assert.ok(profile.priceMax.value > 0, `${p.id} priceMax`);
    }
  });

  it("매매 is the first map filter tenure", () => {
    assert.equal(FILTER_TENURES[0], "trade");
  });
});

describe("35c agent instructions name the buying default", () => {
  it("Korean and English prompts contain the 매매 default rule", () => {
    const ko = Array.isArray(SYSTEM_PROMPT) ? SYSTEM_PROMPT.join("\n") : String(SYSTEM_PROMPT);
    assert.ok(ko.includes("기본은 집을 사는 경우(매매)다"), "Korean default rule");
    assert.ok(ENGLISH_NOTE.includes("The default is buying a home"), "English default rule");
  });
});
