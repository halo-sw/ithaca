import test from "node:test";
import assert from "node:assert/strict";
import { BORDER, COLORS, FONT_FAMILY, MOTION, RADII, SHADOW, TYPE } from "../src/theme.js";

// Guards the app look: these values are copied from web/src/ui/ui.css and
// web/src/ui/money.jsx (see the source comments in theme.js).
test("app surface and ink tokens", () => {
  assert.equal(COLORS.page, "#f6f4ef");
  assert.equal(COLORS.card, "#ffffff");
  assert.equal(COLORS.ink, "#1d1b18");
  assert.equal(COLORS.ink2, "#5f5a52");
  assert.equal(COLORS.ink3, "#8f897f");
  assert.equal(COLORS.accent, "#2f6fed");
});

test("home and verify status colours", () => {
  assert.equal(COLORS.homeA, "#b25a33");
  assert.equal(COLORS.homeB, "#4a7ba7");
  assert.equal(COLORS.ok, "#4a9b6b");
  assert.equal(COLORS.busy, "#d96c3c");
});

test("radii follow the app scale", () => {
  assert.deepEqual([RADII.chip, RADII.card, RADII.sheet], [8, 12, 16]);
});

test("1080p type scale", () => {
  assert.deepEqual(
    [TYPE.title, TYPE.subtitle, TYPE.caption, TYPE.callout],
    [72, 40, 32, 28]
  );
  assert.equal(TYPE.koScale, 0.6);
});

test("card shadow and border come from the app", () => {
  assert.ok(SHADOW.includes("0 8px 24px"));
  assert.ok(BORDER.includes("rgba(30,25,20,.08)"));
});

test("calm motion bounds", () => {
  for (const f of [MOTION.fadeIn, MOTION.fadeOut]) {
    assert.ok(f >= 12 && f <= 18, `fade ${f} outside 12–18 frames`);
  }
  assert.ok(FONT_FAMILY.includes("Pretendard Variable"));
});
