// Stage 36f: one cached drape per area, shared by the home world and
// the journey's second (workplace) area. Each area drapes at most once
// (cached by area id, concurrent calls share one promise); the 4096 px
// mosaic cap lives in drapePlan (aerial/drape.js), and every area gets
// its own mosaic and bounds from drapeAerial. The drape function is
// injectable so node tests can spy on it.
import { drapeAerial } from "./aerial/drape.js";

const drapeByArea = new Map(); // areaId -> Promise

export function resetAreaDrapes() {
  drapeByArea.clear();
}

export function drapedAreaIds() {
  return [...drapeByArea.keys()];
}

export function drapeAreaOnce({ areaId, drapeFn = drapeAerial, args, onOk }) {
  if (!areaId) return Promise.resolve(null);
  if (!drapeByArea.has(areaId)) {
    drapeByArea.set(areaId, Promise.resolve()
      .then(() => drapeFn(args))
      .then((r) => {
        if (r && r.ok && onOk) {
          try {
            onOk(areaId, r);
          } catch { /* a store update must not break the scene */ }
        }
        return r;
      })
      .catch(() => null));
  }
  return drapeByArea.get(areaId);
}
