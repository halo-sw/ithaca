// Stage 29N2f — US home ids unique across areas; the map's network
// follows every candidate path.
//
// 1. buildChatMap with two candidates sharing id "us-home-0021" but in
//    different regions/coords (the live Redwood City + San Carlos pair)
//    yields two distinct pin anchors at different positions, with
//    distinct layout keys.
// 2. The layout pass (specs built as ChatMap builds them, id = pin key)
//    lays out both dup-id homes — neither merges into the other.
// 3. Source check on chat.jsx: the US/Seoul network swap lives in a
//    useEffect keyed on the candidates, and the old inline wantUsNow
//    block is gone from runSearch.
// node --test, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const chatSrc = readFileSync(join(HERE, "..", "src", "ui", "chat.jsx"), "utf8");

let M;
const lazy = (async () => {
  M = await import("../src/chatmap.js");
})();

// The live pair: candidate 5 (515 Cleveland Street, Redwood City) and
// candidate 6 (553 West El Camino Real, San Carlos) shipped the same
// id from two area files.
function dupCandidates() {
  const base = (lon, lat, region) => ({
    id: "us-home-0021",
    name: region === "us-st-redwood-city" ? "515 Cleveland Street" : "553 West El Camino Real",
    kind: "apartment", region, lon, lat,
    build_year: null, scene: null, currency: "USD", country: "US",
    station: { station: "Town", walk_minutes: 6 },
    buckets: [{ center_m2: 60, range_m2: null, trade: null,
      jeonse: null,
      wolse: { count: 1, deposit: null,
        monthly: { count: 1, median_won: 4180, min_won: 4180, max_won: 4180 } } }],
    commute: { total_min: { value: 30, sources: ["osm_graph"] } },
  });
  return [
    base(-122.2344163, 37.4803242, "us-st-redwood-city"),
    base(-122.2607653, 37.5080328, "us-st-san-carlos"),
  ];
}

describe("29N2f repeated ids draw two pins", () => {
  it("buildChatMap keeps both same-id homes at different positions", async () => {
    await lazy;
    const map = M.buildChatMap({
      regions: { regions: [] }, network: null, tiles: [],
      green: { water: [], parks: [] },
      candidates: dupCandidates(), picks: [],
      workplaceStation: null, workPlace: null, tenure: "monthly",
    });
    assert.equal(map.pins.length, 2, "both homes become pins");
    assert.equal(map.pins[0].id, "us-home-0021");
    assert.equal(map.pins[1].id, "us-home-0021");
    assert.notEqual(map.pins[0].key, map.pins[1].key, "layout keys differ");
    assert.ok(map.pins[0].lon !== map.pins[1].lon
      || map.pins[0].lat !== map.pins[1].lat, "different positions");
  });

  it("layoutChatStage lays out both same-id homes, no shared box", async () => {
    await lazy;
    const map = M.buildChatMap({
      regions: { regions: [] }, network: null, tiles: [],
      green: { water: [], parks: [] },
      candidates: dupCandidates(), picks: [],
      workplaceStation: null, workPlace: null, tenure: "monthly",
    });
    // Specs exactly as ChatMap builds them (chatmap.jsx): layout
    // identity is the pin key.
    const specs = map.pins.map((p) => ({ id: p.key, kind: "pill",
      lon: p.lon, lat: p.lat, w: 72, h: 70, rank: 2, pin: p }));
    const focus = [...map.pins];
    const { laid } = M.layoutChatStage({ focus, specs, W: 921, H: 844,
      pad: 24, obstacles: [], tenure: "monthly", lang: "en",
      compact: false });
    const pills = laid.filter((l) => l.kind === "pill" && l.box);
    assert.equal(pills.length, 2, "two laid tags, one per home");
    const boxes = pills.map((l) => `${l.box.x},${l.box.y},${l.box.w},${l.box.h}`);
    assert.equal(new Set(boxes).size, 2, "no two entries share one box");
  });
});

describe("29N2f network swap lives in a candidates effect", () => {
  it("chat.jsx swaps networks in a useEffect on the candidates", () => {
    const eff = chatSrc.indexOf("29N2f");
    assert.ok(eff !== -1, "29N2f effect comment present");
    const block = chatSrc.slice(eff, eff + 2500);
    assert.ok(block.includes("useEffect"), "swap lives in a useEffect");
    assert.ok(block.includes("candidatesData"), "effect keys on the shown candidates");
    assert.ok(block.includes("usSearchActive"), "effect reuses the US check");
    assert.ok(block.includes("loadUsNetwork"), "effect can load the Caltrain doc");
    assert.ok(block.includes("loadNetwork"), "effect can load back the Seoul doc");
    assert.ok(block.includes("usNetReq"), "stale loads are dropped by a token");
    assert.ok(block.includes("setDataTick"), "the map re-renders after the swap");
  });

  it("runSearch no longer swaps networks inline", () => {
    assert.ok(!chatSrc.includes("wantUsNow"), "old inline block is gone");
    assert.ok(!chatSrc.includes("haveUsNow"), "old inline block is gone");
    const at = chatSrc.indexOf("async function runSearch");
    assert.ok(at !== -1, "runSearch still exists");
    const body = chatSrc.slice(at, at + 4000);
    assert.ok(body.includes("setCandidatesData"), "runSearch still sets candidates");
    assert.ok(!body.includes("loadUsNetwork"), "runSearch loads no network itself");
  });

  it("a failed US load shows no lines, never Seoul's", () => {
    const eff = chatSrc.indexOf("29N2f");
    const block = chatSrc.slice(eff, eff + 2500);
    assert.ok(block.includes("{ lines: [] }"), "US failure draws an empty doc");
  });
});

// Stage 29N2h — key-less pins keep their own identity (no shared
// `undefined` merge): two key-less pins at nearby coords render two
// pin tags, and a key-less duplicate-id pair still renders two.
import { register as jsxRegister29N2h } from "node:module";

jsxRegister29N2h("./jsx-loader.mjs", import.meta.url);

const countPins29N2h = (html) => (html.match(/data-layer="home-pin"/g) || []).length;

function keylessPin29N2h(id, lon, lat) {
  const candidate = { id, name: `집${id}`, kind: "오피스텔", region: "bundang",
    dong: "야탑동", lon, lat, build_year: 2003, scene: "st-판교",
    tenures: [{ tenure: "jeonse", median_won: 200000000,
      min_won: 190000000, max_won: 210000000, deals: 7,
      budget_fit: "all", bucket_center_m2: 30 }],
    commute: { walk: { known: true, station: "야탑", minutes: 3.8 },
      ride: { known: true, minutes: 8.5, lines: [], transfers: [],
        derived: { methodsUsed: ["estimate"] } } },
    commute_ko: "판교까지 약 12분" };
  return { id, n: Number(id) || 1, lon, lat, candidate };
}

describe("29N2h key-less pins keep their own identity", () => {
  it("two key-less pins of different ids render two pin tags", async () => {
    const React = (await import("react")).default;
    const { renderToString } = await import("react-dom/server");
    const { ChatMap } = await import("../src/ui/chatmap.jsx");
    const html = renderToString(React.createElement(ChatMap, { map: {
      pins: [keylessPin29N2h("5", 127.1, 37.4), keylessPin29N2h("6", 127.1003, 37.4)],
      regions: [], tenure: "jeonse" } }));
    assert.equal(countPins29N2h(html), 2, "two tags, one per key-less pin");
  });

  it("a key-less duplicate-id pair still renders two pin tags", async () => {
    const React = (await import("react")).default;
    const { renderToString } = await import("react-dom/server");
    const { ChatMap } = await import("../src/ui/chatmap.jsx");
    const html = renderToString(React.createElement(ChatMap, { map: {
      pins: [keylessPin29N2h("1", 127.1, 37.4), keylessPin29N2h("1", 127.1003, 37.4)],
      regions: [], tenure: "jeonse" } }));
    assert.equal(countPins29N2h(html), 2, "same id without keys still draws twice");
  });
});
