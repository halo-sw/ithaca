// Stage 29N2g — the workplace pill never covers a pin tag or
// anchor dot (phone 390×750, "I work at Meta HQ").
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { placeWorkplacePill, shortWorkplaceLabel, freeAreaOf } from "../src/chatmap.js";

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
  && a.y < b.y + b.h && b.y < a.y + a.h;
const grown = (b, g) => ({ x: b.x - g, y: b.y - g, w: b.w + g * 2, h: b.h + g * 2 });

// Live capture: map layer ~390×750 under the tab bar, HQ at
// (309, 541), candidate tags touching the old pill's bottom edge.
const W = 390;
const H = 750;
const HQ = { x: 309, y: 541 };
const TAGS = [
  { x: 92, y: 540, w: 60, h: 58 },
  { x: 191, y: 540, w: 60, h: 58 },
  { x: 260, y: 560, w: 60, h: 58 },
];
const ANCHORS = [{ x: 111, y: 539 }, { x: 222, y: 532 }]
  .map((p) => ({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 }));
const FREE = freeAreaOf(W, H, { top: 56, right: 24, bottom: 96, left: 24 });

describe("29N2g workplace pill avoids pin tags and anchor dots", () => {
  it("phone Meta HQ: the pill box overlaps no tag (8 px gap) and covers no anchor dot", () => {
    const placed = placeWorkplacePill(HQ.x, HQ.y, 241, 26, W, H,
      [...TAGS, ...ANCHORS], FREE);
    assert.equal(placed.side, "above");
    assert.ok(Array.isArray(placed.leader), "a moved pill carries a leader back to HQ");
    for (const t of TAGS) {
      assert.ok(!hit(placed.box, grown(t, 8)),
        `pill keeps 8 px from tag ${JSON.stringify(t)}: ${JSON.stringify(placed.box)}`);
    }
    for (const a of ANCHORS) {
      assert.ok(!hit(placed.box, grown(a, 8)),
        `pill covers no anchor dot ${JSON.stringify(a)}: ${JSON.stringify(placed.box)}`);
    }
  });

  it("free space above HQ: the pill stays above in today's slot", () => {
    // Blockers sit on the right/left/below home slots while staying
    // clear of the above slot — the old right-first pick landed
    // above here too, so the position is unchanged.
    const placed = placeWorkplacePill(320, 210, 120, 26, 640, 420,
      [{ x: 400, y: 197, w: 52, h: 26 },
        { x: 141, y: 197, w: 48, h: 26 },
        { x: 260, y: 222, w: 120, h: 26 }],
      null);
    assert.equal(placed.side, "above");
    assert.deepEqual(placed.box, { x: 260, y: 178, w: 120, h: 26 });
    assert.equal(placed.leader, null);
  });

  it("no free spot shortens the label, dropping the parenthetical address", () => {
    assert.equal(shortWorkplaceLabel("Work · Meta HQ (1 Hacker Way)"), "Work · Meta HQ");
    assert.equal(shortWorkplaceLabel("회사 · 메타 HQ (1 Hacker Way)"), "회사 · 메타 HQ");
    assert.equal(shortWorkplaceLabel("Work · Gangnam"), "Work · Gangnam");
    const placed = placeWorkplacePill(200, 200, 120, 26, 640, 420,
      [{ x: 0, y: 0, w: 640, h: 420 }], null, 80);
    assert.equal(placed.short, true);
    assert.ok(Array.isArray(placed.leader));
  });
});
