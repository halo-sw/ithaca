// Stage 29M1: Muse is the source of English home names; every screen
// uses the same one. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { homeNameEn, registerHomeNamesEn, harvestHomeNamesEn,
  homeNamesEnSnapshot, resetHomeNamesEn,
  dropHomeNamesEnMemoryForTests } from "../src/i18n/home-names.js";
import { romanizeName } from "../src/i18n/romanize.js";
import { resetHomeNamesEnCacheForTests } from "../src/consult/agent.js";
import { tinyArea, tinyScenario } from "./engine-fixture.js";
import { runTurn } from "../src/consult/agent.js";
import { createRunCache } from "../src/consult/tools.js";
import { emptyProfile, field } from "../src/profile.js";

register("./jsx-loader.mjs", import.meta.url);

let React;
let renderToString;
let HomeName;
let trayDisplayName;
let placeNameEn;

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ HomeName } = await import("../src/ui/candidate-card.jsx"));
  ({ trayDisplayName } = await import("../src/ui/chat.jsx"));
  ({ placeNameEn } = await import("../src/ui/scene-chrome.js"));
});

describe("29M1 home-names registry", () => {
  it("falls back to romanizeName, then serves registered names", () => {
    resetHomeNamesEn();
    assert.equal(homeNameEn("대하빌딩"), romanizeName("대하빌딩"));
    assert.equal(homeNameEn("대하빌딩"), "Daeha Building");
    registerHomeNamesEn({ "수정하이츠": "Sujeong Heights" });
    assert.equal(homeNameEn("수정하이츠"), "Sujeong Heights");
  });

  it("ignores empty and Hangul values", () => {
    resetHomeNamesEn();
    registerHomeNamesEn({ "허니하우스": "", "수정하이츠": "수정하이츠" });
    assert.deepEqual(homeNamesEnSnapshot(), {});
  });

  it("a reply-harvested name overrides a registered one", () => {
    resetHomeNamesEn();
    registerHomeNamesEn({ "신일유토빌": "Sinilyuto Vill" });
    registerHomeNamesEn(harvestHomeNamesEn(
      "Sinil Utopil (신일유토빌) is near work.", ["신일유토빌"]));
    assert.equal(homeNameEn("신일유토빌"), "Sinil Utopil");
  });
});

describe("29M1 harvestHomeNamesEn", () => {
  it("pairs English names with known Korean names only", () => {
    const got = harvestHomeNamesEn(
      "Sinil Utopil (신일유토빌) and Daeha Building (대하빌딩) are both a short walk from work.",
      ["신일유토빌", "대하빌딩", "허니하우스"]);
    assert.deepEqual(got, { "신일유토빌": "Sinil Utopil", "대하빌딩": "Daeha Building" });
  });

  it("ignores Hangul that is not a known name", () => {
    const got = harvestHomeNamesEn(
      "Daeha Building (대하빌딩) near Gangnam Stn (강남역).",
      ["대하빌딩"]);
    assert.deepEqual(got, { "대하빌딩": "Daeha Building" });
  });
});

describe("29M1 every screen uses the same name", () => {
  it("HomeName, tray and 3D pill read the registry", () => {
    resetHomeNamesEn();
    registerHomeNamesEn({ "허니하우스": "Honey House" });
    const html = renderToString(
      React.createElement(HomeName, { name: "허니하우스", lang: "en" }));
    assert.ok(html.includes("허니하우스"), html);
    assert.ok(html.includes("(Honey House)"), html);
    assert.equal(trayDisplayName("허니하우스", "en"), "Honey House");
    assert.equal(placeNameEn("허니하우스"), "Honey House");
    assert.equal(placeNameEn("강남역"), "Gangnam Stn");
  });
});

// --- consult agent: Muse names the homes up front (English only) ---

function bucket(jeonse) {
  return {
    center_m2: 60, range_m2: [55, 65],
    trade: null,
    jeonse: { count: jeonse[0], median_won: jeonse[1],
      min_won: jeonse[2], max_won: jeonse[3] },
    wolse: null,
  };
}

const HOMES = {
  homes: [{
    id: "home-000001", name: "대하빌딩", kind: "아파트", region: "bundang",
    lon: 127.11, lat: 37.38, build_year: 2005,
    buckets: [bucket([4, 350000000, 300000000, 380000000])],
    station: null, scene: null, photos_700m: 0,
  }],
};

const NETWORK = {
  lines: [{
    id: "bundang", name: "수인·분당선",
    stops: [
      { id: "s1", key: "정자", name: "정자" },
      { id: "s2", key: "판교", name: "판교" },
    ],
    patterns: [{ id: "p1", stops: ["s1", "s2"], chainage_km: [0, 2.0] }],
  }],
};

function profile() {
  const p = emptyProfile();
  p.members = field([{ role: "adult" }], "customer", "");
  p.workplaces = field([{ member: 0, text: "판교", resolved: { station: "판교" } }],
    "customer", "");
  p.tenure = field("jeonse", "customer", "");
  p.depositMax = field(400000000, "customer", "");
  return p;
}

function baseOpts(context) {
  return {
    provider: "meta",
    scenario: tinyScenario({ days: 2, background: 0, seed: 7,
      homes: [{ label: "A", area: "pangyo", complex_name: "대하빌딩" }] }),
    cache: createRunCache(),
    loadArea: async () => tinyArea(),
    loadHomes: async () => HOMES,
    loadRegion: async () => ({ network: NETWORK, congestion: null }),
    loadPhotos: async () => ({ items: [] }),
    messages: [{ role: "user", content: "Gangnam commute, 2 people, jeonse under 400M" }],
    context,
  };
}

function usage() {
  return { prompt_tokens: 1, completion_tokens: 1 };
}

// Fake provider: main-loop calls carry tools; the JSON names call and
// the English retry do not. The names branch answers (or throws) per test.
function fakeComplete({ onNames, reply }) {
  const seen = [];
  const fn = async (args) => {
    seen.push(args);
    const text = JSON.stringify(args.messages || []);
    if (text.includes("Give the English name")) {
      return onNames(args);
    }
    if (args.tools) {
      if (!fn.tooled) {
        fn.tooled = true;
        return {
          message: { content: "",
            tool_calls: [{ id: "c1", name: "find_homes", args: { profile: profile() } }] },
          finish: "tool_calls", usage: usage(), latency_ms: 1,
          provider: "meta", model: "muse-spark-1.3",
        };
      }
    }
    return {
      message: { content: reply, tool_calls: [] }, finish: "stop",
      usage: usage(), latency_ms: 1, provider: "meta", model: "muse-spark-1.3",
    };
  };
  fn.seen = seen;
  fn.namesCalls = () => seen.filter((a) =>
    JSON.stringify(a.messages || []).includes("Give the English name"));
  return fn;
}

function toolContents(out) {
  return (out.messages || [])
    .filter((m) => m && m.role === "tool" && typeof m.content === "string")
    .map((m) => { try { return JSON.parse(m.content); } catch { return null; } })
    .filter(Boolean);
}

const REPLY = "Daeha Building (대하빌딩) is a short walk from work.";

describe("29M1 agent names homes up front", () => {
  it("stamps name_en on candidates and returns names_en", async () => {
    resetHomeNamesEnCacheForTests();
    const complete = fakeComplete({
      reply: REPLY,
      onNames: async () => ({
        message: { content: "{\"names\":{\"대하빌딩\":\"Daeha Building\"}}", tool_calls: [] },
        finish: "stop", usage: usage(), latency_ms: 1,
        provider: "meta", model: "muse-spark-1.3",
      }),
    });
    const out = await runTurn({
      ...baseOpts({ lang: "en", profile: profile(), names_en: {} }),
      completeFn: complete,
    });
    assert.equal(out.ok, true);
    assert.equal(complete.namesCalls().length, 1);
    const all = toolContents(out);
    const withCandidates = all.find((r) => Array.isArray(r.candidates));
    assert.ok(withCandidates, "a candidates tool result is read by the model");
    assert.ok(withCandidates.candidates.length > 0);
    assert.equal(withCandidates.candidates[0].name_en, "Daeha Building");
    assert.equal(out.names_en["대하빌딩"], "Daeha Building");
  });

  it("a name already in context.names_en triggers no names call", async () => {
    resetHomeNamesEnCacheForTests();
    const complete = fakeComplete({
      reply: REPLY,
      onNames: async () => { throw new Error("must not be called"); },
    });
    const out = await runTurn({
      ...baseOpts({ lang: "en", profile: profile(),
        names_en: { "대하빌딩": "Daeha Building" } }),
      completeFn: complete,
    });
    assert.equal(out.ok, true);
    assert.equal(complete.namesCalls().length, 0);
    const withCandidates = toolContents(out).find((r) => Array.isArray(r.candidates));
    assert.equal(withCandidates.candidates[0].name_en, "Daeha Building");
    assert.equal(out.names_en["대하빌딩"], "Daeha Building");
  });

  it("Korean sessions make no names call", async () => {
    resetHomeNamesEnCacheForTests();
    const complete = fakeComplete({
      reply: "대하빌딩은 걸어서 출근돼요.",
      onNames: async () => { throw new Error("must not be called"); },
    });
    const out = await runTurn({
      ...baseOpts({ lang: "ko", profile: profile() }), completeFn: complete,
    });
    assert.equal(out.ok, true);
    assert.equal(complete.namesCalls().length, 0);
  });

  it("a names call that throws leaves the turn working", async () => {
    resetHomeNamesEnCacheForTests();
    const complete = fakeComplete({
      reply: REPLY,
      onNames: async () => { throw new Error("provider down"); },
    });
    const out = await runTurn({
      ...baseOpts({ lang: "en", profile: profile(), names_en: {} }),
      completeFn: complete,
    });
    assert.equal(out.ok, true);
    assert.equal(complete.namesCalls().length, 1);
  });
});

describe("29M1b home-names persist across documents", () => {
  it("a fresh page memory still reads the stored name", () => {
    const prev = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => { store.set(String(k), String(v)); },
      removeItem: (k) => { store.delete(String(k)); },
    };
    try {
      resetHomeNamesEn();
      registerHomeNamesEn({ "신일유토빌": "Sinil Utopil" });
      dropHomeNamesEnMemoryForTests();
      assert.equal(homeNameEn("신일유토빌"), "Sinil Utopil");
      assert.equal(homeNamesEnSnapshot()["신일유토빌"], "Sinil Utopil");
    } finally {
      resetHomeNamesEn();
      if (prev === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prev;
      dropHomeNamesEnMemoryForTests();
    }
  });

  it("throwing storage leaves memory register and read working", () => {
    const prev = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: () => { throw new Error("no storage"); },
      setItem: () => { throw new Error("no storage"); },
      removeItem: () => { throw new Error("no storage"); },
    };
    try {
      dropHomeNamesEnMemoryForTests();
      assert.equal(registerHomeNamesEn({ "수정하이츠": "Sujeong Heights" }), 1);
      assert.equal(homeNameEn("수정하이츠"), "Sujeong Heights");
    } finally {
      if (prev === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prev;
      resetHomeNamesEn();
      dropHomeNamesEnMemoryForTests();
    }
  });
});
