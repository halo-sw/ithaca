// 45a: absolute occlusion lift for the follow camera (pure, no WebGL).
// The lift is a goal offset probed from the nominal goal camera position
// and smoothed over elapsed real seconds. Frame-rate independent: the
// exponential approach converges identically for any dt subdivision.
export const FOLLOW_LIFT_MAX_M = 60;
export const FOLLOW_LIFT_HOLD_S = 0.3;
export const FOLLOW_LIFT_RISE_TAU_S = 0.45;
export const FOLLOW_LIFT_FALL_TAU_S = 0.6;
export const FOLLOW_LIFT_DT_MAX_S = 0.5;

export function initialFollowLiftState() {
  return { lift: 0, clearS: 0 };
}

export function updateFollowLift(state, opts = {}) {
  const prev = state && typeof state === "object" ? state : {};
  let lift = Number(prev.lift);
  if (!Number.isFinite(lift)) lift = 0;
  let clearS = Number(prev.clearS);
  if (!Number.isFinite(clearS)) clearS = 0;
  let maxLift = Number(opts.maxLift);
  if (!Number.isFinite(maxLift)) maxLift = FOLLOW_LIFT_MAX_M;
  maxLift = Math.min(FOLLOW_LIFT_MAX_M, Math.max(0, maxLift));
  lift = Math.min(maxLift, Math.max(0, lift));
  clearS = Math.max(0, clearS);
  const blocked = Boolean(opts.blocked);
  let dt = Number(opts.dt);
  if (!Number.isFinite(dt)) return { lift, clearS };
  dt = Math.min(FOLLOW_LIFT_DT_MAX_S, Math.max(0, dt));
  if (dt <= 0) return { lift, clearS };
  let holdS = Number(opts.holdS);
  if (!Number.isFinite(holdS) || holdS < 0) holdS = FOLLOW_LIFT_HOLD_S;
  let riseTau = Number(opts.riseTauS);
  if (!Number.isFinite(riseTau) || riseTau <= 0) riseTau = FOLLOW_LIFT_RISE_TAU_S;
  let fallTau = Number(opts.fallTauS);
  if (!Number.isFinite(fallTau) || fallTau <= 0) fallTau = FOLLOW_LIFT_FALL_TAU_S;
  if (blocked) {
    lift += (maxLift - lift) * (1 - Math.exp(-dt / riseTau));
    clearS = 0;
  } else {
    clearS += dt;
    if (clearS >= holdS) lift *= Math.exp(-dt / fallTau);
  }
  if (!Number.isFinite(lift)) lift = 0;
  lift = Math.min(maxLift, Math.max(0, lift));
  return { lift, clearS };
}
