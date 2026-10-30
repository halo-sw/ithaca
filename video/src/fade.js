// Pure calm-motion math: fades and short eased slides. Components apply these
// as opacity / translateY; all timing stays testable in plain Node.
import { MOTION } from "./theme.js";

export function clamp01(t) {
  if (t < 0) {
    return 0;
  }
  if (t > 1) {
    return 1;
  }
  return t;
}

export function easeOutCubic(t) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

// Whole-scene fade in and out (15 frames each at 30 fps).
export function sceneOpacity(frame, durationInFrames) {
  if (
    !Number.isFinite(frame) ||
    !Number.isFinite(durationInFrames) ||
    durationInFrames <= 0
  ) {
    return 0;
  }
  const fadeIn = clamp01(frame / MOTION.fadeIn);
  const fadeOut = clamp01((durationInFrames - frame) / MOTION.fadeOut);
  return Math.min(fadeIn, fadeOut);
}

// Fade a line/pill/step in once its appear frame arrives; stays at 1.
export function appearOpacity(frame, appearFrame, fadeFrames = MOTION.fadeIn) {
  return clamp01((frame - appearFrame) / fadeFrames);
}

// Short upward slide while appearing; rests at 0.
export function riseOffset(
  frame,
  appearFrame,
  fadeFrames = MOTION.fadeIn,
  distPx = MOTION.slidePx
) {
  return distPx * (1 - easeOutCubic((frame - appearFrame) / fadeFrames));
}

// A pill/step visible on [fromFrame, untilFrame): fade in after fromFrame,
// fade out before untilFrame (12 frames each so short windows still work).
export function windowOpacity(frame, fromFrame, untilFrame, fadeFrames = 12) {
  return Math.min(
    clamp01((frame - fromFrame) / fadeFrames),
    clamp01((untilFrame - frame) / fadeFrames)
  );
}
