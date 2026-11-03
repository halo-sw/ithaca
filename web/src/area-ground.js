// Stage 36f: one cached drape per area, shared by the home world and
// the journey's second (workplace) area. Each area drapes at most once
// (cached by area id, concurrent calls share one promise); the 4096 px
// mosaic cap lives in drapePlan (aerial/drape.js), and every area gets
// its own mosaic and bounds from drapeAerial. The drape function is
// injectable so node tests can spy on it.
import { drapeAerial } from "./aerial/drape.js";

const drapeByArea = new Map(); // areaId -> { promise, refs }

// 45c: the cache identity is the area id plus the actual mesh/scene
// targets. Calls with no mesh targets (unit spies) keep area-only
// identity via an empty refs list.
const TARGET_FIELDS = ["scene", "terrainMesh", "groundMesh", "fringeMesh"];

function targetRefs(args) {
  if (!args || typeof args !== "object") return [];
  const refs = [];
  for (const k of TARGET_FIELDS) {
    if (args[k] != null) refs.push(args[k]);
  }
  return refs;
}

function sameRefs(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function resetAreaDrapes() {
  drapeByArea.clear();
}

export function forgetAreaDrape(areaId) {
  if (!areaId) return;
  drapeByArea.delete(areaId);
}

export function drapedAreaIds() {
  return [...drapeByArea.keys()];
}

export function drapeAreaOnce({ areaId, drapeFn = drapeAerial, args, onOk }) {
  if (!areaId) return Promise.resolve(null);
  const refs = targetRefs(args);
  const existing = drapeByArea.get(areaId);
  if (existing && sameRefs(existing.refs, refs)) return existing.promise;
  // 46e: forward the progressive coarse preview through the same
  // staleness-guarded onOk. Bare spy args pass through untouched —
  // custom drapeFns may compare args by identity — so a wrapper is
  // only built when a preview listener exists, and the caller's own
  // onPreview (if any) is preserved and called only while current.
  let callArgs = args;
  let p = null;
  const needsPreview = typeof onOk === "function"
    || (args && typeof args === "object" && typeof args.onPreview === "function");
  if (needsPreview && args && typeof args === "object") {
    const userPreview = args.onPreview;
    callArgs = { ...args,
      onPreview: (r) => {
        const cur = drapeByArea.get(areaId);
        if (!cur || cur.promise !== p) return;
        if (typeof userPreview === "function") {
          try { userPreview(r); } catch { /* listener errors stay local */ }
        }
        if (r && r.ok && onOk) {
          try {
            onOk(areaId, r);
          } catch { /* a store update must not break the scene */ }
        }
      } };
  }
  p = Promise.resolve()
    .then(() => drapeFn(callArgs))
    .then((r) => {
      const curOk = drapeByArea.get(areaId);
      if (r && r.ok && onOk && curOk && curOk.promise === p) {
        try {
          onOk(areaId, r);
        } catch { /* a store update must not break the scene */ }
      }
      // Failed/null results leave no cache entry so a later retry can
      // drape again — but never evict a newer target's promise.
      if (!r || !r.ok) {
        const cur = drapeByArea.get(areaId);
        if (cur && cur.promise === p) drapeByArea.delete(areaId);
      }
      return r;
    })
    .catch(() => {
      const cur = drapeByArea.get(areaId);
      if (cur && cur.promise === p) drapeByArea.delete(areaId);
      return null;
    });
  drapeByArea.set(areaId, { promise: p, refs });
  return p;
}
