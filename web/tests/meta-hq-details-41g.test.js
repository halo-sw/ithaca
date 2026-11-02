// Stage 41g: Meta HQ scenario details (pure-function tests).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commuteMinutesOf, layoutChatStage, runCommuteModeOf } from "../src/chatmap.js";
import { citationsFor, isUsToolContext } from "../src/ui/agent-float.js";
import { extract_profile, lowerMidSentenceMemberLabels } from "../src/profile.js";
import { META_HQ_EXAMPLE, META_HQ_EXAMPLE_KO } from "../src/places-us.js";
import { clampLabelBox } from "../src/stage-tags.js";
import { cleanDiarySummary, ruleDiary, writeDiary } from "../src/consult/diary.js";
import { reportCallBudget, writeReport } from "../src/consult/report.js";
import { consultTimeoutMs } from "../src/ui/consult-client.js";

const KO_SENTENCE = "멘로파크 Meta 본사로 출근해요. 두 명이고, 월세는 4,500달러 이하예요.";

function profileOf(text) {
  const r = extract_profile(text, null, { stations: [] });
  return r.profile || r;
}

describe("41g Korean Meta HQ sentence parses like the English one", () => {
  it("same profile fields", () => {
    assert.ok(META_HQ_EXAMPLE_KO.includes("4,500"), META_HQ_EXAMPLE_KO);
    const ko = profileOf(KO_SENTENCE);
    const en = profileOf(META_HQ_EXAMPLE);
    const pick = (p) => ({
      members: (p.members.value || []).length,
      monthlyMax: p.monthlyMax.value,
      currency: p.currency.value,
      tenure: p.tenure.value,
      workplace: (p.workplaces.value[0] && p.workplaces.value[0].resolved
        && p.workplaces.value[0].resolved.place.id) || null,
    });
    assert.deepEqual(pick(ko), pick(en));
    assert.equal(pick(ko).members, 2);
    assert.equal(pick(ko).monthlyMax, 4500);
    assert.equal(pick(ko).currency, "USD");
    assert.equal(pick(ko).workplace, "meta-hq");
  });
});

describe("41g US session cites US sources without USD tool args", () => {
  const bare = [{ name: "price_reference", args: {} }];
  it("isUsToolContext sees the session", () => {
    assert.equal(isUsToolContext(bare, { usSession: true }), true);
    assert.equal(isUsToolContext(bare), false);
  });
  it("chip builder cites US sources on a US session", () => {
    const us = citationsFor(["price_reference"], { toolCalls: bare, usSession: true });
    assert.ok(us.length > 0);
    assert.ok(us.every((c) => !/국토교통부/.test(c.title)), JSON.stringify(us));
    const kr = citationsFor(["price_reference"], { toolCalls: bare });
    assert.ok(kr.some((c) => /국토교통부/.test(c.title)), JSON.stringify(kr));
  });
});

function usCandidate(id, n, lon, lat, picked, letter) {
  return {
    id, kind: "pill", lon, lat, w: 120, h: 60, rank: picked ? 1 : 2,
    pin: {
      n, picked, letter, commuteMin: 11,
      candidate: {
        id, region: "us-menlo", currency: "USD",
        tenures: [{ tenure: "wolse", median_won: 4261, min_won: 4261,
          max_won: 4261, deals: 1, budget_fit: "all", deposit_median_won: null }],
        commute: { work: { target: "meta-hq", name: "Meta HQ",
          walk_minutes: 36.5, bike_minutes: 11.4, mode: "bike", minutes: 11.4 } },
      },
    },
  };
}

describe("41g picked homes keep their own pin outside the cluster", () => {
  it("A and B lay out as pills, never cluster rows", () => {
    const base = [-122.1602, 37.4624];
    const specs = [0, 1, 2, 3, 4].map((i) => usCandidate(`us-h-${i}`, i + 1,
      base[0] + i * 0.0001, base[1] + i * 0.0001, i < 2, i < 2 ? "AB"[i] : null));
    const focus = specs.map((s) => ({ lon: s.lon, lat: s.lat }));
    const { laid, cards } = layoutChatStage({ focus, specs, W: 800, H: 600,
      pad: null, obstacles: [], tenure: "wolse", lang: "en",
      compact: false, sharedRent: true, mixedTenure: false });
    const pills = laid.filter((l) => l.kind === "pill").map((l) => l.id);
    assert.ok(pills.includes("us-h-0"), JSON.stringify(laid.map((l) => l.id)));
    assert.ok(pills.includes("us-h-1"), JSON.stringify(laid.map((l) => l.id)));
    for (const card of cards.values()) {
      for (const row of card.rows || []) {
        assert.equal(row.picked || false, false, JSON.stringify(row));
      }
    }
  });
});

describe("41g pin minutes follow the 30-day run mode", () => {
  const candidate = {
    best_min: 5,
    commute: { work: { walk_minutes: 15, bike_minutes: 5, mode: "walk", minutes: 15 } },
  };
  it("walk run mode pins 15, not the 5-min bike", () => {
    assert.equal(commuteMinutesOf(candidate, "walk"), 15);
    assert.equal(commuteMinutesOf(candidate, "bike"), 5);
  });
  it("reads the run's last-mile mode off its ride aways", () => {
    const bike = { aways: [{ kind: "ride",
      detail: { dest_walk: { minutes: 11, mode: "bike" } } }] };
    assert.equal(runCommuteModeOf(bike), "bike");
    const walk = { aways: [{ kind: "ride",
      detail: { dest_walk: { minutes: 36 } } }] };
    assert.equal(runCommuteModeOf(walk), "walk");
    assert.equal(runCommuteModeOf({ aways: [] }), null);
    assert.equal(runCommuteModeOf(null), null);
  });
});

describe("41g 3D labels never paint cut", () => {
  const stage = { left: 0, top: 0, width: 800, height: 600 };
  it("off-screen anchor hides; inside anchor stays inside", () => {
    const off = clampLabelBox(-20, 400, 60, 20, stage);
    assert.equal(off.visible, false);
    const on = clampLabelBox(400, 300, 60, 20, stage);
    assert.equal(on.visible, true);
    assert.ok(on.x >= 0 && on.x + 60 <= 800 && on.y >= 0 && on.y + 20 <= 600);
  });
});

describe("41g member label case mid-sentence", () => {
  it("second label lower-cased", () => {
    assert.equal(
      lowerMidSentenceMemberLabels("You averaged 13.9 minutes and Your partner averaged 13.9 minutes one-way."),
      "You averaged 13.9 minutes and your partner averaged 13.9 minutes one-way.");
  });
  it("diary summary never starts with 'Muse '", () => {
    assert.equal(cleanDiarySummary("Muse A 777 Hamilton: 14 min."), "A 777 Hamilton: 14 min.");
    assert.ok(!cleanDiarySummary("Muse A 777 Hamilton: 14 min.").startsWith("Muse "));
  });
});

function twoHomeDigests() {
  const facts = (home) => [3, 10, 20].map((day, i) => ({
    id: `${home}${i}`, day, minute: 500 + day, kind: "commute",
    text_ko: `${day}일째 출근 14분`, numbers: [day, 14],
  }));
  return ["A", "B"].map((label) => ({ label, name: label === "A" ? "777 Hamilton" : "10 Coleman",
    facts: facts(label), totals: { one_way_min: 14 } }));
}

describe("41g diary tolerates Spark Open", () => {
  it("empty provider content falls back to the rule diary after 1 call", async () => {
    let calls = 0;
    const complete = async () => {
      calls++;
      return { message: { content: "" }, usage: {} };
    };
    const out = await writeDiary({ complete, provider: "baseten",
      digests: twoHomeDigests(), lang: "en" });
    assert.equal(calls, 1);
    assert.ok(out.lines.length > 0, "rule diary lines, not an empty list");
    assert.ok(out.check.summary_fallback);
  });
  it("a failing first reply retries once (2 calls)", async () => {
    let calls = 0;
    const complete = async () => {
      calls++;
      if (calls === 1) {
        return { message: { content: JSON.stringify({
          summary: "", lines: [{ home: "ZZZ", id: "zzz0", text: "없는 집 줄" }] }) },
        usage: {} };
      }
      return { message: { content: "" }, usage: {} };
    };
    const out = await writeDiary({ complete, provider: "baseten",
      digests: twoHomeDigests(), lang: "en" });
    assert.equal(calls, 2);
    assert.ok(out.lines.length > 0, "rule diary lines, not an empty list");
  });
});

describe("41g report check tolerates Spark Open", () => {
  it("one timeout is retried and passes", async () => {
    let calls = 0;
    const failing = Object.assign(new Error("timed out"), { code: "timeout" });
    const call = async () => {
      calls++;
      if (calls === 1) throw failing;
      return { message: { content: "", tool_calls: [{
        id: "t1", name: "submit_report",
        args: { sentences: [] } }] }, usage: {} };
    };
    const runs = { A: { agents: [], totals: {}, trips: [], aways: [], decisions: [] },
      B: { agents: [], totals: {}, trips: [], aways: [], decisions: [] } };
    const out = await writeReport({ call, provider: "baseten", runs,
      labels: ["A", "B"], homes: { A: {}, B: {} }, names: {}, persona: "couple",
      groundTruth: { personas: { couple: { items: [] } }, common_items: [] }, lang: "en" });
    assert.equal(calls, 2);
    assert.equal(out.ok, true);
  });
  it("baseten budgets exceed meta", () => {
    const b = reportCallBudget("baseten");
    const m = reportCallBudget("meta");
    assert.ok(b.timeoutMs > m.timeoutMs && b.maxTokens >= m.maxTokens);
    assert.ok(consultTimeoutMs("baseten") > consultTimeoutMs("meta"));
  });
});
