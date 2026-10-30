// Pure callout timing: each callout shows at its `at` second and stays 4 s,
// unless the next callout (or the scene end) comes sooner.
export const CALLOUT_HOLD_SEC = 4;

export function calloutWindows(callouts, sceneDurationSec) {
  if (!Array.isArray(callouts) || callouts.length === 0) {
    return [];
  }
  const sorted = [...callouts].sort((a, b) => a.at - b.at);
  return sorted.map((callout, i) => {
    const nextAt =
      i + 1 < sorted.length ? sorted[i + 1].at : sceneDurationSec;
    const until = Math.min(callout.at + CALLOUT_HOLD_SEC, nextAt, sceneDurationSec);
    return { ...callout, until };
  });
}
