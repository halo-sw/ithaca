// 45a: stable follow camera — absolute occlusion lift, frame-rate
// independence, continuous fractional ride time (pure helpers, no WebGL).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOLLOW_LIFT_MAX_M, initialFollowLiftState,
  updateFollowLift } from "../src/render/follow-camera.js";
import { journeyBanner, journeyCameraState, legAt } from "../src/journey.js";

const SEG = {
  out: { start: 500, end: 530 },
  work: { start: 530, end: 1070 },
  back: { start: 1070, end: 1100 },
};

function runLift({ blocked, seconds, fps, start = null }) {
  let st = start || initialFollowLiftState();
  const dt = 1 / fps;
  const n = Math.round(seconds * fps);
  for (let i = 0; i < n; i++) st = updateFollowLift(st, { blocked, dt });
  return st;
}

test("sustained blocked input keeps lift bounded 0–60", () => {
  const st = runLift({ blocked: true, seconds: 10, fps: 60 });
  assert.ok(st.lift > 0, `lift rises ${st.lift}`);
  assert.ok(st.lift <= FOLLOW_LIFT_MAX_M, `lift ${st.lift} capped`);
  assert.equal(FOLLOW_LIFT_MAX_M, 60);
});

test("clear input settles toward zero after the hold", () => {
  const high = runLift({ blocked: true, seconds: 5, fps: 60 });
  assert.ok(high.lift > 50, `starts high ${high.lift}`);
  const settled = runLift({ blocked: false, seconds: 3, fps: 60, start: high });
  assert.ok(settled.lift < 1, `settles ${settled.lift}`);
});

test("short alternating clear samples do not chatter", () => {
  let st = initialFollowLiftState();
  let drops = 0;
  let prev = 0;
  for (let i = 0; i < 120; i++) {
    st = updateFollowLift(st, { blocked: i % 2 === 0, dt: 1 / 60 });
    if (st.lift < prev - 1e-12) drops++;
    prev = st.lift;
  }
  assert.equal(drops, 0, "no lowering during sub-hold flicker");
  assert.ok(st.lift > 0, `still raised ${st.lift}`);
});

test("equal-duration lift transitions match at 30/60/120 fps", () => {
  const a = runLift({ blocked: true, seconds: 2, fps: 30 });
  const b = runLift({ blocked: true, seconds: 2, fps: 60 });
  const c = runLift({ blocked: true, seconds: 2, fps: 120 });
  assert.ok(Math.abs(a.lift - b.lift) < 1e-6, `${a.lift} vs ${b.lift}`);
  assert.ok(Math.abs(b.lift - c.lift) < 1e-6, `${b.lift} vs ${c.lift}`);
  const d = runLift({ blocked: false, seconds: 2, fps: 30, start: a });
  const e = runLift({ blocked: false, seconds: 2, fps: 120, start: a });
  assert.ok(Math.abs(d.lift - e.lift) < 0.5, `${d.lift} vs ${e.lift}`);
});

test("dt=0 does not advance state; invalid values cannot create NaN", () => {
  const s = runLift({ blocked: true, seconds: 1, fps: 60 });
  const same = updateFollowLift(s, { blocked: true, dt: 0 });
  assert.deepEqual(same, s);
  for (const bad of [NaN, Infinity, -Infinity, -1, "x", undefined]) {
    const out = updateFollowLift(s, { blocked: true, dt: bad });
    assert.ok(Number.isFinite(out.lift) && Number.isFinite(out.clearS),
      `dt=${String(bad)} → ${JSON.stringify(out)}`);
  }
  const junk = updateFollowLift(null, {});
  assert.deepEqual(junk, { lift: 0, clearS: 0 });
  const nanState = updateFollowLift({ lift: NaN, clearS: NaN },
    { blocked: true, dt: NaN });
  assert.ok(Number.isFinite(nanState.lift), "sanitized lift");
  assert.ok(nanState.lift >= 0 && nanState.lift <= 60, "bounded lift");
});

test("fractional times within one minute move continuously", () => {
  const a = journeyCameraState({ segments: SEG, minute: 515 });
  const b = journeyCameraState({ segments: SEG, minute: 515.5 });
  assert.equal(a.phase, "cruise");
  assert.equal(b.phase, "cruise");
  assert.ok(b.elapsed > a.elapsed, `${a.elapsed} → ${b.elapsed}`);
  assert.ok(b.progress > a.progress, `${a.progress} → ${b.progress}`);
  assert.equal(b.elapsed, 15.5);
  // Integer boundary phases are unchanged.
  assert.equal(journeyCameraState({ segments: SEG, minute: 499 }).phase, "street");
  assert.equal(journeyCameraState({ segments: SEG, minute: 500 }).phase, "rising");
  assert.equal(journeyCameraState({ segments: SEG, minute: 529.9 }).phase, "cruise");
  assert.equal(journeyCameraState({ segments: SEG, minute: 530 }).phase, "hold");
  assert.equal(journeyCameraState({ segments: SEG, minute: 1085 }).phase, "cruise");
  assert.equal(journeyCameraState({ segments: SEG, minute: 1100 }).phase, "street");
});

test("train sampling moves continuously; captions stay integer-based", () => {
  const ride = { legs: [{ lineName: "L", from: "A", to: "B", minutes: 30,
    congestion: { valuePct: 10, source: "s" } }], transfers: [] };
  const at1 = legAt(ride, 15);
  const at2 = legAt(ride, 15.5);
  assert.ok(at2.legElapsed > at1.legElapsed, "leg sampling continuous");
  const b1 = journeyBanner({ ride, dir: "out", elapsed: 15, rideMinutes: 30 });
  const b2 = journeyBanner({ ride, dir: "out", elapsed: 15.9, rideMinutes: 30 });
  assert.equal(b1.minutesLeft, 15);
  assert.equal(b2.minutesLeft, 15);
});
