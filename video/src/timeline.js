// Pure timeline helpers: scene seconds -> Remotion frames, plus continuity checks.

export function sceneToFrames(scene, fps) {
  const from = Math.round(scene.start * fps);
  const durationInFrames = Math.round(scene.duration * fps);
  return { from, durationInFrames };
}

export function totalDurationInFrames(script) {
  const scenes = script && Array.isArray(script.scenes) ? script.scenes : [];
  if (scenes.length === 0) {
    return 0;
  }
  const last = scenes[scenes.length - 1];
  return Math.round((last.start + last.duration) * script.fps);
}

// Returns an array of error strings; empty means the script is continuous and
// every callout falls inside its scene.
export function validateScript(script) {
  const errors = [];
  const scenes = script && Array.isArray(script.scenes) ? script.scenes : [];
  if (scenes.length === 0) {
    errors.push("no scenes");
    return errors;
  }
  if (!Number.isFinite(script.fps) || script.fps <= 0) {
    errors.push(`invalid fps: ${script.fps}`);
  }
  if (scenes[0].start !== 0) {
    errors.push(
      `first scene ${scenes[0].id} starts at ${scenes[0].start}, expected 0`
    );
  }
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    if (!Number.isFinite(s.start) || !Number.isFinite(s.duration)) {
      errors.push(`scene ${s.id} has non-numeric start/duration`);
      continue;
    }
    if (s.duration <= 0) {
      errors.push(`scene ${s.id} has non-positive duration ${s.duration}`);
    }
    if (i > 0) {
      const prev = scenes[i - 1];
      const expected = prev.start + prev.duration;
      if (s.start < expected) {
        errors.push(
          `scene ${s.id} overlaps previous (starts ${s.start}, previous ends ${expected})`
        );
      } else if (s.start > expected) {
        errors.push(
          `scene ${s.id} leaves a gap (starts ${s.start}, previous ends ${expected})`
        );
      }
    }
    if (s.callouts !== undefined) {
      if (!Array.isArray(s.callouts)) {
        errors.push(`scene ${s.id} callouts is not an array`);
      } else {
        for (let j = 0; j < s.callouts.length; j += 1) {
          const c = s.callouts[j];
          if (!c || !Number.isFinite(c.at) || c.at < 0 || c.at >= s.duration) {
            errors.push(
              `scene ${s.id} callout ${j} at=${c ? c.at : c} outside [0, ${s.duration})`
            );
          }
        }
      }
    }
    if (s.zooms !== undefined) {
      if (!Array.isArray(s.zooms)) {
        errors.push(`scene ${s.id} zooms is not an array`);
      } else {
        for (let j = 0; j < s.zooms.length; j += 1) {
          const z = s.zooms[j];
          const timingOk =
            z &&
            Number.isFinite(z.at) &&
            Number.isFinite(z.until) &&
            z.at >= 0 &&
            z.at < z.until &&
            z.until <= s.duration;
          const r = z ? z.rect : undefined;
          const rectOk =
            Array.isArray(r) &&
            r.length === 4 &&
            r.every((v) => Number.isFinite(v)) &&
            r[0] >= 0 &&
            r[1] >= 0 &&
            r[0] <= 1 &&
            r[1] <= 1 &&
            r[2] > 0 &&
            r[3] > 0 &&
            r[0] + r[2] <= 1 &&
            r[1] + r[3] <= 1;
          if (!timingOk || !rectOk) {
            errors.push(
              `scene ${s.id} zoom ${j} invalid (need 0 <= at < until <= ${s.duration} and rect [x, y, w, h] inside [0, 1] with w, h > 0)`
            );
          }
        }
      }
    }
  }
  return errors;
}
