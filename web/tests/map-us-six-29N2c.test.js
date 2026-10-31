// Stage 29N2c — two tags never share one spot: the six US homes
// (Menlo ×2, Palo Alto ×2, Redwood City, San Carlos) + Meta HQ lay
// out with no overlapping boxes, every leader landing on its own
// drawn box, every box inside the free area. node --test, no network.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

let M;
let workPinLabel;

before(async () => {
  M = await import("../src/chatmap.js");
  ({ workPinLabel } = await import("../src/ui/chatmap.jsx"));
});

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;

// The six homes from the 29N2b capture: candidates 5 and 6 shared
// one 72×70 spot at (555, 285) with a leader to an empty spot.
const SIX = [
  ["1", "777 Hamilton", -122.1561971, 37.4795456, "us-menlo", 4100, 18],
  ["2", "1221 Willow Road", -122.1540321, 37.4746227, "us-menlo", 4261, 20],
  ["3", "344-348 Kipling Street", -122.1615958, 37.4486218, "us-st-palo-alto", 4450, 24],
  ["4", "275 Hawthorne Avenue", -122.1657664, 37.4482227, "us-st-palo-alto", 4320, 25],
  ["5", "515 Cleveland Street", -122.2344163, 37.4803242, "us-st-redwood-city", 4180, 31],
  ["6", "553 West El Camino Real", -122.2607653, 37.5080328, "us-st-san-carlos", 4600, 35],
];
const HQ = { name: "Meta HQ", lon: -122.14823, lat: 37.48485 };

function sixCandidates() {
  return SIX.map(([id, name, lon, lat, region, rent, mins]) => ({
    id, name, lon, lat, region, area_m2: 60 + Number(id),
    currency: "USD",
    commute: { walk: { known: true, station: "Downtown", minutes: 3 },
      ride: { known: true, minutes: mins - 3 } },
    tenures: [{ tenure: "monthly", median_won: rent, currency: "USD" }],
  }));
}

function sixMap() {
  return M.buildChatMap({
    regions: { regions: [] },
    network: null, tiles: [], green: { water: [], parks: [] },
    candidates: sixCandidates(), picks: [],
    workplaceStation: null,
    workPlace: HQ, tenure: "monthly",
  });
}

function pillWidth(text, px) {
  let tw = 0;
  for (const ch of String(text || "")) tw += ch.codePointAt(0) > 0xff ? px : Math.round(px * 0.58);
  return tw;
}

function stageSpecs(map, tenure, lang, compact) {
  const specs = [];
  if (map.workPin) {
    const label = workPinLabel(map.workPin.name, lang);
    specs.push({ id: "work", kind: "work",
      lon: map.workPin.lon, lat: map.workPin.lat,
      w: pillWidth(label, 12) + 38, h: 26, rank: 0 });
  }
  for (const p of map.pins) {
    const sz = M.tagSizePx(p, tenure, lang, { compact, mixedTenure: false });
    const shortSz = M.tagSizePx(p, tenure, lang, { compact, short: true, mixedTenure: false });
    specs.push({ id: p.id, kind: "pill", lon: p.lon, lat: p.lat,
      w: sz.w, h: sz.h, alt: { w: shortSz.w, h: shortSz.h },
      rank: 2, pin: p });
  }
  return specs;
}

// Production chrome shapes: the top-left filter/legend stack, the
// right control column, the bottom tray, the credit line.
function stageObstacles(W, H) {
  return [
    { x: 0, y: 0, w: Math.min(300, W * 0.5), h: 140 },
    { x: W - 64, y: 0, w: 64, h: H },
    { x: 0, y: H - 96, w: W, h: 96 },
    { x: W - 188, y: H - 26, w: 180, h: 18 },
  ];
}

function runStage(map, tenure, lang, W, H) {
  const compact = W <= 480;
  const focus = [];
  if (map.workPin) focus.push(map.workPin);
  for (const p of map.pins) focus.push(p);
  const pad = M.fitInsetFromChrome({ W, H, top: 140, bottom: 96, right: 64, tagH: 56 });
  return { ...M.layoutChatStage({ focus,
    specs: stageSpecs(map, tenure, lang, compact),
    W, H, pad, obstacles: stageObstacles(W, H),
    tenure, lang, compact, sharedRent: false, mixedTenure: false }), pad };
}

function checkStage(W, H) {
  const { laid, pad } = runStage(sixMap(), "monthly", "en", W, H);
  const free = M.freeAreaOf(W, H, pad);
  const boxes = laid.map((l) => l.box).filter(Boolean);
  // All six homes visible as tags or card rows.
  for (const [id] of SIX) {
    const tagged = laid.some((l) => l.id === id && l.box);
    const rowed = laid.some((l) => (l.members || []).some((m) => m.id === id)
      || (l.rows || []).some((r) => r.id === id));
    assert.ok(tagged || rowed, `home ${id} visible as a tag or a card row`);
  }
  // No two boxes overlap (intersection area 0).
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(!hit(boxes[i], boxes[j]),
        `boxes ${i}/${j} do not overlap: ${JSON.stringify(boxes[i])} vs ${JSON.stringify(boxes[j])}`);
    }
  }
  // Every leader ends on its own drawn box.
  for (const l of laid) {
    if (!l.leader || !l.box) continue;
    const [lx, ly] = l.leader;
    assert.ok(lx >= l.box.x && lx <= l.box.x + l.box.w
      && ly >= l.box.y && ly <= l.box.y + l.box.h,
    `leader of ${l.id} lands on its box`);
  }
  // Every box inside the free area.
  for (const b of boxes) {
    assert.ok(b.x >= free.x + 4 && b.y >= free.y + 4
      && b.x + b.w <= free.x + free.w - 4
      && b.y + b.h <= free.y + free.h - 4,
    `box inside the free area: ${JSON.stringify(b)} free ${JSON.stringify(free)}`);
  }
}

describe("29N2c two tags never share one spot", () => {
  it("921x844: six homes + HQ, no overlaps, leaders on boxes", () => {
    checkStage(921, 844);
  });

  it("390x600: six homes + HQ, no overlaps, leaders on boxes", () => {
    checkStage(390, 600);
  });
});
