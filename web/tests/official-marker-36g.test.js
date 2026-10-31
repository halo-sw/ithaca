// Stage 36g2 — official/estimate ride labels, the walk→ride marker
// join, and the English sim credit.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

register("./jsx-loader.mjs", import.meta.url);

import { joinWalkToRide } from "../src/journey.js";
import { parseInterstationCsv, rideMinutes } from "../src/transit/schedule.js";
import { commuteSummary } from "../src/homes.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

let commuteRowLine;

before(async () => {
  ({ commuteRowLine } = await import("../src/ui/candidate-card.jsx"));
});

function rowFromDerived(derived, station = "잠실") {
  return {
    id: "c1",
    commute: {
      walk: { known: true, station, minutes: 7 },
      ride: { known: true, minutes: derived.minutes, source: "derived", derived },
    },
  };
}

describe("36g ride labels: estimate when any leg is an estimate", () => {
  let schedule;
  before(async () => {
    const text = await readFile(
      join(REPO, "scenarios", "transit", "seoul-metro-interstation.csv"), "utf8");
    schedule = parseInterstationCsv(text);
  });

  const schedLeg = {
    line: "line2", lineName: "2호선",
    stops: ["잠실", "잠실새내"], stopIds: ["a", "b"], distanceKm: 1.2,
  };
  const estLeg = {
    line: "sinbundang", lineName: "신분당선",
    stops: ["강남", "판교"], stopIds: ["c", "d"], distanceKm: 10.0,
  };

  it("legs [schedule, estimate] → estimate", () => {
    const r = rideMinutes("잠실", "판교",
      { from: "잠실", to: "판교", legs: [schedLeg, estLeg], transfers: [], distanceKm: 11.2 },
      schedule);
    assert.deepEqual(r.legs.map((l) => l.method), ["schedule", "estimate"]);
    assert.ok(r.methodsUsed.includes("estimate"), `methods: ${r.methodsUsed}`);
    assert.equal(commuteRowLine(rowFromDerived(r)).source, "estimate");
  });

  it("legs [schedule, schedule] → official", () => {
    const r = rideMinutes("잠실", "잠실새내",
      { from: "잠실", to: "잠실새내", legs: [schedLeg], transfers: [], distanceKm: 1.2 },
      schedule);
    assert.deepEqual(r.methodsUsed, ["schedule"]);
    assert.equal(commuteRowLine(rowFromDerived(r)).source, "official");
  });

  it("customer ride → said", () => {
    const cand = {
      id: "c2",
      commute: {
        walk: { known: true, station: "잠실", minutes: 7 },
        ride: { known: true, minutes: 30, source: "customer", note: "고객님이 알려주신 값" },
      },
    };
    assert.equal(commuteRowLine(cand, "판교").source, "said");
  });

  it("same station → unchanged", () => {
    const cand = {
      id: "c3",
      commute: {
        walk: { known: true, station: "판교", minutes: 5 },
        ride: { known: true, minutes: 0, source: "derived", sameStation: true },
        sameStation: true,
      },
    };
    const line = commuteRowLine(cand, "판교");
    assert.equal(line.text, "판교역까지 걸어서 5분 (지하철 안 타요)");
    assert.equal(line.source, "official");
  });

  it("home-014844 → 판교 labels estimate (real data)", async () => {
    const homePath = join(REPO, "data/build/homes/songpa-gu.json");
    const netPath = join(REPO, "data/build/region/network.json");
    if (!existsSync(homePath) || !existsSync(netPath)) {
      console.log("  (skip: no local data/build)");
      return;
    }
    const doc = JSON.parse(readFileSync(homePath, "utf8"));
    const home = (doc.homes || []).find((h) => h.id === "home-014844");
    assert.ok(home, "home-014844 in songpa-gu.json");
    const network = JSON.parse(readFileSync(netPath, "utf8"));
    const summary = commuteSummary(home, { resolved: { station: "판교" } }, network, schedule);
    assert.ok(summary.ride.known, "ride derives for 송파나루 → 판교");
    const line = commuteRowLine({ id: home.id, commute: summary }, "판교");
    assert.equal(line.source, "estimate");
  });
});

function haversineM(a, b) {
  const r = 6371000;
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dp = ((b[1] - a[1]) * Math.PI) / 180;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

describe("36g joinWalkToRide bridges the station gap", () => {
  // P: the OSM station node the walk reached. Q: the line data's stop,
  // 145 m east of P. R: the alighting walk's start.
  const P = [127.0, 37.5];
  const Q = [127.0 + 145 / (111320 * Math.cos((37.5 * Math.PI) / 180)), 37.5];
  const M = [Q[0] + 0.0005, Q[1] + 0.0005];
  const R = [M[0] + 0.0002, M[1] + 0.0001];

  it("starts at P, ends at R, joins densified to ≤5 m", () => {
    assert.ok(Math.abs(haversineM(P, Q) - 145) < 1, `Q is 145 m out: ${haversineM(P, Q)}`);
    const joined = joinWalkToRide(P, [Q, M], R);
    assert.deepEqual(joined[0], P);
    assert.deepEqual(joined[joined.length - 1], R);
    const iQ = joined.findIndex((p) => p[0] === Q[0] && p[1] === Q[1]);
    assert.ok(iQ > 0, "the ride start is still on the path");
    for (let i = 0; i < iQ; i++) {
      assert.ok(haversineM(joined[i], joined[i + 1]) <= 5, `head gap ${i}`);
    }
    const iM = joined.findIndex((p) => p[0] === M[0] && p[1] === M[1]);
    assert.ok(iM > iQ, "the middle survives the join");
    for (let i = iM; i + 1 < joined.length; i++) {
      assert.ok(haversineM(joined[i], joined[i + 1]) <= 5, `tail gap ${i}`);
    }
  });

  it("leaves an already-joined path alone", () => {
    assert.deepEqual(joinWalkToRide(null, [Q, M], null), [Q, M]);
    assert.deepEqual(joinWalkToRide(Q, [Q, M], M), [Q, M]);
  });
});

describe("36g SimCredit in English", () => {
  let React;
  let renderToString;
  let SimCredit;

  before(async () => {
    React = (await import("react")).default;
    ({ renderToString } = await import("react-dom/server"));
    ({ SimCredit } = await import("../src/ui/app.jsx"));
  });

  const render = (state) => renderToString(React.createElement(SimCredit, { state }));

  function withLang(lang, fn) {
    const prev = globalThis.window;
    const kept = {};
    globalThis.window = {
      location: { search: lang === "en" ? "?lang=en" : "?lang=ko" },
      localStorage: {
        getItem: () => kept["ithaca.lang"] ?? null,
        setItem: (k, v) => { kept[k] = v; },
      },
      navigator: { language: "ko-KR" },
    };
    try {
      return fn();
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  }

  it("English with the drape: one MOLIT line, no Hangul", () => {
    const html = withLang("en", () => render({ aerial: true }));
    assert.ok(html.includes("Aerial photo © MOLIT"), `credit: ${html}`);
    assert.ok(!/[가-힣]/.test(html), `no Hangul: ${html}`);
  });

  it("English without the drape: OSM only", () => {
    const html = withLang("en", () => render({}));
    assert.ok(html.includes("© OpenStreetMap"), `credit: ${html}`);
    assert.ok(!html.includes("MOLIT"), `no aerial claim: ${html}`);
  });

  it("US areas keep their USGS credit", () => {
    const html = withLang("en", () => render({ aerial: true, money: { currency: "USD" } }));
    assert.ok(html.includes("USGS"), `credit: ${html}`);
    assert.ok(!html.includes("MOLIT"), `no MOLIT for the US: ${html}`);
  });

  it("Korean is unchanged", () => {
    const html = withLang("ko", () => render({ aerial: true }));
    assert.ok(html.includes("항공사진 © 국토교통부 공간정보 오픈플랫폼(VWorld)"), `credit: ${html}`);
    assert.ok(html.includes("ui-simcredit-full") && html.includes("ui-simcredit-short"),
      `two spans as today: ${html}`);
  });
});
