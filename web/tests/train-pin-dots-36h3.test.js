// Stage 36h3: the train pin sits on its line, station dots stay 14 px,
// English crowding lines name their lines (node --test, no network).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { DOT_DIAM, RIDE_LIFT, STATION_DOT_PX, markerScaleFor,
  patternById, trainPosition, viewDepthM } from "../src/journey.js";
import { lonLatToXY } from "../src/frame.js";
import { sliceGeometry } from "../src/corridor.js";
import { commuteLines } from "../src/evidence.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const NET = join(ROOT, "data", "build", "region", "network.json");
const DEMO = join(ROOT, "data", "build", "sim", "demo-two-homes-A.json");
const hasData = existsSync(NET) && existsSync(DEMO);

const W = 1440;
const H = 810;
const FOV = 10;
const TAN = Math.tan((FOV * Math.PI) / 180 / 2);

// Same projection chain setTrain uses: lonLatToXY at RIDE_LIFT.
const toW = (lon, lat, origin) => {
  const [x, y] = lonLatToXY(lon, lat, origin);
  return new THREE.Vector3(x, RIDE_LIFT, -y);
};

function realRide() {
  const network = JSON.parse(readFileSync(NET, "utf8"));
  const demo = JSON.parse(readFileSync(DEMO, "utf8"));
  const away = (demo.aways || []).find((a) => a && a.agent === "h1"
    && a.day === 0 && a.kind === "ride");
  assert.ok(away, "h1 day-0 ride away");
  assert.ok(away.detail && away.detail.ride, "ride detail");
  return { network, demo, away, ride: away.detail.ride };
}

// Drawn-path vertices exactly as the layer builds them: per-hop
// sliceGeometry at the shared lift.
function drawnPath(network, ride, origin) {
  const coords = new Map();
  for (const line of network.lines || []) {
    for (const s of line.stops || []) coords.set(s.id, [s.lon, s.lat]);
  }
  const pts = [];
  for (const leg of ride.legs || []) {
    const pattern = patternById(network, leg.patternId);
    const geom = pattern && pattern.geometry;
    if (!geom) continue;
    for (let i = 0; i + 1 < (leg.stopIds || []).length; i++) {
      const a = coords.get(leg.stopIds[i]);
      const b = coords.get(leg.stopIds[i + 1]);
      if (!a || !b) continue;
      for (const ll of sliceGeometry(geom, a, b)) pts.push(toW(ll[0], ll[1], origin));
    }
  }
  return pts;
}

function stationDots(network, ride, origin) {
  const coords = new Map();
  for (const line of network.lines || []) {
    for (const s of line.stops || []) coords.set(s.id, [s.lon, s.lat]);
  }
  const seen = new Set();
  const pts = [];
  for (const leg of ride.legs || []) {
    for (const sid of leg.stopIds || []) {
      const c = coords.get(sid);
      if (!c || seen.has(sid)) continue;
      seen.add(sid);
      pts.push(toW(c[0], c[1], origin));
    }
  }
  return pts;
}

function followCam(pinW) {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 1, 20000);
  cam.position.set(pinW.x + 330, pinW.y + 130, pinW.z + 350); // ~500 m, low
  cam.lookAt(pinW);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

function regionalCam(pinW) {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 1, 50000);
  cam.position.set(pinW.x, pinW.y + 3000, pinW.z + 900); // 3 km up
  cam.lookAt(pinW);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

function offsetCam(pinW) {
  const cam = followCam(pinW);
  cam.setViewOffset(W, H, 180, 0, W, H); // drawer overlap, as trackSimViewOffset
  cam.updateProjectionMatrix();
  return cam;
}

function toPx(cam, v) {
  const p = v.clone().project(cam);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z };
}

describe("36h3 pin on line", () => {
  it("one height feeds pin, path and dots", () => {
    const src = readFileSync(join(HERE, "..", "src", "journey-scene.js"), "utf8");
    assert.match(src, /toWorld\(\[pos\.lon, pos\.lat\], RIDE_LIFT\)/);
    assert.ok(!/toWorld\([^)]*,\s*90\)/.test(src), "no 90 m pin lift left");
    assert.ok(src.split("RIDE_LIFT").length - 1 >= 7, "shared lift everywhere");
  });
  it("pin within 4 px of the drawn path at elapsed 8", { skip: !hasData }, () => {
    const { network, ride } = realRide();
    const pos = trainPosition(network, ride, 8);
    assert.ok(pos, "train position at elapsed 8");
    const origin = { lon: pos.lon, lat: pos.lat };
    const pinW = toW(pos.lon, pos.lat, origin);
    const path = drawnPath(network, ride, origin);
    assert.ok(path.length > 0, "drawn path vertices");
    for (const mk of [followCam, offsetCam, regionalCam]) {
      const cam = mk(pinW);
      const pp = toPx(cam, pinW);
      const seg = (a, b) => {
        if (a.z > 1 || a.z < -1 || b.z > 1 || b.z < -1) return Infinity;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.min(1, Math.max(0,
          ((pp.x - a.x) * dx + (pp.y - a.y) * dy) / ((dx * dx + dy * dy) || 1)));
        return Math.hypot(a.x + dx * t - pp.x, a.y + dy * t - pp.y);
      };
      let best = Infinity;
      for (let i = 0; i + 1 < path.length; i++) {
        best = Math.min(best, seg(toPx(cam, path[i]), toPx(cam, path[i + 1])));
      }
      assert.ok(best <= 4, `${mk.name}: pin ${best.toFixed(2)} px off path`);
    }
  });
});

describe("36h3 dots stay 14 px", () => {
  it("every visible dot ≤ 14 px (hull ≤ 17.5), offset or not", { skip: !hasData }, () => {
    const { network, ride } = realRide();
    const pos = trainPosition(network, ride, 8);
    const origin = { lon: pos.lon, lat: pos.lat };
    const pinW = toW(pos.lon, pos.lat, origin);
    const dots = stationDots(network, ride, origin);
    assert.ok(dots.length > 0, "station dots");
    for (const mk of [followCam, offsetCam, regionalCam]) {
      const cam = mk(pinW);
      const dir = cam.getWorldDirection(new THREE.Vector3());
      const proj5 = cam.projectionMatrix.elements[5];
      let checked = 0;
      for (const p of dots) {
        if (toPx(cam, p).z > 1 || toPx(cam, p).z < -1) continue;
        const depth = viewDepthM(cam.position, dir, p);
        const s = markerScaleFor(depth, FOV, H, DOT_DIAM, STATION_DOT_PX);
        const px = (s * DOT_DIAM * proj5 * H) / (2 * depth);
        assert.ok(px <= 14.001, `${mk.name}: dot ${px.toFixed(2)} px`);
        assert.ok(px * 1.25 <= 17.501, `${mk.name}: hull ${(px * 1.25).toFixed(2)} px`);
        checked += 1;
      }
      assert.ok(checked > 0, `${mk.name}: dots in view`);
    }
  });
  it("root cause: Euclidean distance overshoots off-axis dots", () => {
    const cam = followCam(new THREE.Vector3(0, RIDE_LIFT, 0));
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const dot = cam.position.clone().addScaledVector(dir, 100).addScaledVector(side, 300);
    const depth = viewDepthM(cam.position, dir, dot);
    const euclid = cam.position.distanceTo(dot);
    assert.ok(euclid / depth > 2, `off-axis ratio ${euclid / depth}`);
    const proj5 = cam.projectionMatrix.elements[5];
    const oldPx = (markerScaleFor(euclid, FOV, H, DOT_DIAM, STATION_DOT_PX)
      * DOT_DIAM * proj5 * H) / (2 * depth);
    assert.ok(oldPx > 14, `old Euclidean scale renders ${oldPx.toFixed(1)} px`);
    const px = (markerScaleFor(depth, FOV, H, DOT_DIAM, STATION_DOT_PX)
      * DOT_DIAM * proj5 * H) / (2 * depth);
    assert.ok(px <= 14.001, `depth scale renders ${px.toFixed(2)} px`);
  });
});

describe("36h3 English line names", () => {
  it("real A ride gives the two exact lines", { skip: !hasData }, () => {
    const { demo } = realRide();
    const trip = (demo.trips || []).find((t) => t && t.agent === "h1"
      && t.day === 0 && t.purpose === "commute");
    assert.ok(trip, "h1 day-0 commute trip");
    const lines = commuteLines(demo, "h1", trip, trip.depart_min, "en");
    const assumed = lines.find((l) => l.text.includes("is assumed (not measured)"));
    assert.equal(assumed.text,
      "Crowding 70% on Line 9, Suin-Bundang Line, Gyeonggang Line is assumed (not measured)");
    const measured = lines.find((l) => l.text.includes("is measured (Seoul Metro)"));
    assert.equal(measured.text, "Crowding 100% on Line 8 is measured (Seoul Metro)");
  });
});
