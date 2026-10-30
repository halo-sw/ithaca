// Pure verify-step helpers: tone by text/position, even spacing across the scene.

// A step counts as a fail when its text starts with "Check:".
export function stepTone(text, isLast) {
  if (typeof text === "string" && text.startsWith("Check:")) {
    return "fail";
  }
  if (isLast) {
    return "pass";
  }
  return "normal";
}

// Step i of n appears at i/n of the scene (first at 0, last gets a full slot).
export function stepAppearFrame(i, n, durationInFrames) {
  if (n <= 0) {
    return 0;
  }
  return Math.round((i * durationInFrames) / n);
}
