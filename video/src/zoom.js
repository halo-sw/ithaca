// Pure zoom math for ScreenScene clip zoom-ins.
// A zoom window is { at, until, rect: [x, y, w, h] } with seconds
// scene-relative and rect normalised (0-1) to the clip (16:9).
// zoomTransform returns a CSS-ready { scale, tx, ty } where tx/ty are
// screen pixels applied as `translate(tx, ty) scale(s)` about the box
// centre (translate in screen space, after the scale).

export const ZOOM_EASE_FRAMES = 18;
export const ZOOM_MAX_SCALE = 2.5;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Easing.inOut(Easing.cubic) as pure math.
export function easeInOutCubic(t) {
  const u = clamp(t, 0, 1);
  if (u < 0.5) {
    return 4 * u * u * u;
  }
  return 1 - Math.pow(-2 * u + 2, 3) / 2;
}

// Full-strength target for one rect: fit the rect into the box, cap 2.5,
// then centre the rect, clamped so no clip edge enters the box.
export function zoomTarget(rect, boxW, boxH) {
  const [x, y, w, h] = rect;
  const scale = Math.min(1 / Math.max(w, h), ZOOM_MAX_SCALE);
  const cx = (x + w / 2 - 0.5) * boxW;
  const cy = (y + h / 2 - 0.5) * boxH;
  const maxTx = Math.max(0, (scale * boxW - boxW) / 2);
  const maxTy = Math.max(0, (scale * boxH - boxH) / 2);
  return {
    scale,
    tx: clamp(-cx * scale, -maxTx, maxTx),
    ty: clamp(-cy * scale, -maxTy, maxTy),
  };
}

export function zoomTransform(zooms, tSec, boxW, boxH, fps) {
  if (!Array.isArray(zooms) || !Number.isFinite(tSec)) {
    return { scale: 1, tx: 0, ty: 0 };
  }
  const win =
    zooms.find(
      (z) =>
        z &&
        Array.isArray(z.rect) &&
        Number.isFinite(z.at) &&
        Number.isFinite(z.until) &&
        tSec >= z.at &&
        tSec < z.until
    ) ?? null;
  if (!win || !Number.isFinite(fps) || fps <= 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }
  const target = zoomTarget(win.rect, boxW, boxH);
  const pos = (tSec - win.at) * fps;
  const total = (win.until - win.at) * fps;
  const k = Math.min(
    easeInOutCubic(pos / ZOOM_EASE_FRAMES),
    easeInOutCubic((total - 1 - pos) / ZOOM_EASE_FRAMES)
  );
  if (k <= 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }
  return {
    scale: 1 + (target.scale - 1) * k,
    tx: target.tx * k,
    ty: target.ty * k,
  };
}
