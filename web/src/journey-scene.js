// Journey 3D layer: line, stations, train marker, corridor tiles.
//
// Owns every journey object under one THREE.Group: the travelled line
// (per-segment congestion colours), station dots, the moving train
// marker, the corridor base map (a land-coloured ground plane over the
// manifest bounds plus merged major-road and open-water ribbons), and
// the full set of corridor tiles. Pure picking/math lives in journey.js
// and corridor.js; this module only builds, positions and disposes
// meshes. main.js drives it from the sim clock for the camera, but tile
// loading runs in a background loop of its own (preloadCorridor), so a
// paused clock never stalls the map.

import * as THREE from "three";
import { lonLatToXY, xyToLonLat } from "./frame.js";
import { uvForLonLat } from "./aerial/tiles.js";
import { BAND_COLORS, STATION_DOT_PX, corridorLoadPlan, markerScaleFor, patternById, trainPosition } from "./journey.js";
import { baseMapBounds, hexToRgb, sliceGeometry, tileBuildings, tileLines,
  tileRoadRibbons, tileWater, tileWaterRibbons } from "./corridor.js";
import { assetUrl } from "./paths.js";
import { congestionBand } from "./engine/journey.js";
import { DEFAULT_LOOK } from "./render/look.js";

// Background preload: at most this many tile fetches in flight. 65
// tiles ≈ 11k buildings load in a few seconds without jank.
export const PRELOAD_CONCURRENCY = 6;

// The tile cap is the corridor's own tile count (all of c1 fits); the
// only unloading is on corridor change (setManifest).
export function tileCapFor(manifest) {
  const n = manifest && manifest.tiles && manifest.tiles.length;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function soupGeometry(soup) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(soup.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(soup.normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(soup.colors, 3));
  return geo;
}

// 36c2: split a non-indexed triangle soup into roof vertex indices
// (face normal y > 0.9) and wall indices (the rest). Stored normals win
// when present (corridor roof caps may wind either way); otherwise the
// geometric normal from positions decides. Pure, no three.js.
export function splitRoofWall(positions, normals = null) {
  const roofIdx = [];
  const wallIdx = [];
  const tris = Math.floor(positions.length / 9);
  for (let t = 0; t < tris; t++) {
    const i0 = t * 3, i1 = i0 + 1, i2 = i0 + 2;
    let ny = NaN;
    if (normals && normals.length >= (i2 + 1) * 3) {
      ny = (normals[i0 * 3 + 1] + normals[i1 * 3 + 1] + normals[i2 * 3 + 1]) / 3;
    }
    if (!Number.isFinite(ny)) {
      const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
      const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
      const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, nyy, nz);
      ny = len > 0 ? nyy / len : -1;
    }
    if (ny > 0.9) roofIdx.push(i0, i1, i2);
    else wallIdx.push(i0, i1, i2);
  }
  return { roofIdx, wallIdx };
}

export function stopCoords(network) {
  const out = new Map();
  for (const line of (network && network.lines) || []) {
    for (const s of line.stops || []) out.set(s.id, [s.lon, s.lat]);
  }
  return out;
}

const numOr = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function createJourneyLayer(scene, origin, { look = null, tags = null } = {}) {
  const l = look || DEFAULT_LOOK;
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const tileGroup = new THREE.Group();
  group.add(tileGroup);

  // Stage 11: corridor buildings read slightly darker (material colour
  // multiplies the vertex colours) so the line, the train and the
  // stations separate from the blocks on the regional view.
  const buildingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  buildingMat.color.setScalar(Number.isFinite(l.corridorDarken) ? l.corridorDarken : 1);
  // 36c2: corridor roofs share the corridor aerial texture once the
  // drape lands (white base so the photo reads true, like station
  // roofs); walls always keep buildingMat.
  const roofAerialMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  roofAerialMat.color.setRGB(1, 1, 1);
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const groundMat = new THREE.MeshStandardMaterial({
    color: numOr(l.regionalGround, DEFAULT_LOOK.regionalGround),
    roughness: 1, metalness: 0 });
  const rgbRoad = hexToRgb(numOr(l.regionalRoad, DEFAULT_LOOK.regionalRoad));
  const rgbWater = hexToRgb(numOr(l.regionalWater, DEFAULT_LOOK.regionalWater));
  const dotGeo = new THREE.SphereGeometry(18, 10, 8);
  // 17c: marker outline + sizing. Dots get a dark hull (same instances
  // ×1.25, drawn first) so white reads on beige. World sizes feed
  // markerScaleFor (journey.js). 19e: the train cone is gone — the train
  // is an HTML .trainpin in the tags layer, constant size by construction.
  const DOT_DIAM = 36;
  const DOT_HULL = 1.25;
  const OUTLINE_DARK = 0x222222;

  let lineMesh = null;
  let dotMesh = null;
  let dotHull = null;
  let dotWorld = []; // world Vector3 per station dot (for rescaling)
  let trainPin = null; // {root, dot, labelEl} HTML train marker (19e)
  let groundMesh = null;
  let roadMesh = null;
  let waterOpenMesh = null;
  let tiles = new Map(); // tile id -> {meshes}
  let roadAcc = null; // merged ribbon accumulators, rebuilt per arrival
  let waterOpenAcc = null;
  let stationLabels = []; // {el, pos: THREE.Vector3}
  let rideKey = "";
  let manifest = null;
  let drapeHook = null; // 36c: corridor aerial drape (registered by main.js)
  let corridorMosaic = null; // 36c2: { texture, range, zoom } once the corridor drape lands
  let network = null;
  let congestion = null;
  let dayKind = "weekday";
  let slotMinute = 0;
  let fallbackPct = 70;
  let preload = null; // {key, promise, listeners, cancelled}

  const toWorld = ([lon, lat], lift = 0) => {
    const [x, y] = lonLatToXY(lon, lat, origin);
    return new THREE.Vector3(x, lift, -y);
  };

  function clearLabels() {
    for (const s of stationLabels) {
      if (s.el && s.el.parentNode) s.el.parentNode.removeChild(s.el);
    }
    stationLabels = [];
  }

  function clearPath() {
    for (const mesh of [lineMesh, dotMesh, dotHull]) {
      if (mesh) {
        group.remove(mesh);
        if (mesh.geometry && mesh.geometry !== dotGeo) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      }
    }
    lineMesh = dotMesh = dotHull = null;
    hideTrainPin();
    if (trainPin && trainPin.root.parentNode) {
      trainPin.root.parentNode.removeChild(trainPin.root);
    }
    trainPin = null;
    dotWorld = [];
    clearLabels();
    rideKey = "";
  }

  function unloadTile(id) {
    const slot = tiles.get(id);
    if (!slot) return;
    for (const m of slot.meshes) {
      tileGroup.remove(m);
      m.geometry.dispose();
    }
    tiles.delete(id);
  }

  function unloadAllTiles() {
    for (const id of [...tiles.keys()]) unloadTile(id);
  }

  function resetBaseMap() {
    for (const mesh of [groundMesh, roadMesh, waterOpenMesh]) {
      if (mesh) {
        tileGroup.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    groundMesh = roadMesh = waterOpenMesh = null;
    roadAcc = { positions: [], normals: [], colors: [] };
    waterOpenAcc = { positions: [], normals: [], colors: [] };
  }

  // Land-coloured plane over the manifest bounds: the view is never an
  // empty plane, even before the first tile lands.
  function buildBaseMap() {
    resetBaseMap();
    if (!manifest) return;
    const rect = baseMapBounds(manifest, origin);
    if (!(rect.w > 0 && rect.d > 0)) return;
    groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.d), groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(rect.cx, 0, rect.cz);
    groundMesh.frustumCulled = false;
    tileGroup.add(groundMesh);
  }

  function rebuildMerged() {
    if (roadMesh) {
      tileGroup.remove(roadMesh);
      roadMesh.geometry.dispose();
      roadMesh = null;
    }
    if (roadAcc.positions.length > 0) {
      roadMesh = new THREE.Mesh(soupGeometry(roadAcc), roadMat);
      roadMesh.frustumCulled = false;
      tileGroup.add(roadMesh);
    }
    if (waterOpenMesh) {
      tileGroup.remove(waterOpenMesh);
      waterOpenMesh.geometry.dispose();
      waterOpenMesh = null;
    }
    if (waterOpenAcc.positions.length > 0) {
      waterOpenMesh = new THREE.Mesh(soupGeometry(waterOpenAcc), waterMat);
      waterOpenMesh.frustumCulled = false;
      tileGroup.add(waterOpenMesh);
    }
  }

  // Per-hop congestion: the hop origin station's own reading for the
  // ride's slot (same table the engine used for the leg boarding).
  // Without the table, every hop inherits its leg's reading.
  function hopCongestion(leg, stopName, pattern) {
    if (!congestion || !congestion.days) {
      return { valuePct: leg.congestion.valuePct, source: leg.congestion.source };
    }
    const table = congestion.days[dayKind];
    const rows = table && table[leg.lineName] && table[leg.lineName][stopName];
    const value = rows && rows[pattern.direction_label];
    const slots = (congestion && congestion.slots) || [];
    let idx = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slotMinute >= slots[i]) idx = i;
      else break;
    }
    if (Array.isArray(value) && idx < value.length && value[idx] !== null) {
      return { valuePct: value[idx], source: "서울교통공사" };
    }
    return { valuePct: fallbackPct, source: "가정값" };
  }

  function setPath({ ride, network: net, congestion: cong, dayKind: dk, minute, fallback }) {
    network = net;
    congestion = cong || null;
    dayKind = dk;
    slotMinute = minute;
    fallbackPct = fallback;
    clearPath();
    if (!ride || !network) return;
    const coords = stopCoords(network);
    const positions = [];
    const colors = [];
    const dotPositions = [];
    const c = new THREE.Color();
    for (const leg of ride.legs) {
      const pattern = patternById(network, leg.patternId);
      const geom = pattern && pattern.geometry;
      if (!geom || geom.length < 2) continue;
      for (let i = 0; i + 1 < leg.stops.length; i++) {
        const a = coords.get(leg.stopIds[i]);
        const b = coords.get(leg.stopIds[i + 1]);
        if (!a || !b) continue;
        const slice = sliceGeometry(geom, a, b);
        if (slice.length < 2) continue;
        const cong = hopCongestion(leg, leg.stops[i], pattern);
        const band = congestionBand(cong.valuePct).key;
        c.setHex(BAND_COLORS[band]);
        for (let k = 0; k + 1 < slice.length; k++) {
          const p0 = toWorld(slice[k], 60);
          const p1 = toWorld(slice[k + 1], 60);
          positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
          colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
      }
      for (const sid of leg.stopIds) {
        const s = coords.get(sid);
        if (s) dotPositions.push(s);
      }
    }
    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      lineMesh = new THREE.LineSegments(geo,
        new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false,
          transparent: true,
          opacity: Number.isFinite(l.lineOpacity) ? l.lineOpacity : 0.95 }));
      lineMesh.renderOrder = 990;
      lineMesh.frustumCulled = false;
      group.add(lineMesh);
    }
    if (dotPositions.length > 0) {
      dotMesh = new THREE.InstancedMesh(dotGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false,
          transparent: true, opacity: 0.9 }), dotPositions.length);
      // Dark hull under the white dots: same instances ×1.25, drawn
      // first — a ~1 px dark rim so dots read on beige (17c).
      dotHull = new THREE.InstancedMesh(dotGeo,
        new THREE.MeshBasicMaterial({ color: OUTLINE_DARK, depthTest: false,
          transparent: true, opacity: 0.9 }), dotPositions.length);
      const dummy = new THREE.Object3D();
      dotWorld = dotPositions.map(([lon, lat]) => toWorld([lon, lat], 60));
      // 19g: seed at scale 0 — updateMarkerScale sizes every visible
      // dot to ≤ 14 px each frame, so a phase that skips the rescale
      // can never leave an authored-size (36 m) disc on screen.
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      dotWorld.forEach((p, i) => {
        dummy.position.copy(p);
        dummy.updateMatrix();
        dotMesh.setMatrixAt(i, dummy.matrix);
        dotHull.setMatrixAt(i, dummy.matrix);
      });
      dotMesh.instanceMatrix.needsUpdate = true;
      dotHull.instanceMatrix.needsUpdate = true;
      // Draw ladder: line 990, hull 991, dots 992.
      dotHull.renderOrder = 991;
      dotHull.frustumCulled = false;
      dotMesh.renderOrder = 992;
      dotMesh.frustumCulled = false;
      group.add(dotHull, dotMesh);
    }
    // 19e: no 3D train mesh — setTrain draws the HTML .trainpin instead.
    buildStationLabels(ride, coords);
    rideKey = `${ride.legs.map((l) => `${l.line}:${l.from}>${l.to}`).join("+")}`;
    group.visible = true;
  }

  // Station names along the travelled line (deduped by name: transfer
  // stations serve two lines at the same place). HTML tags in the shared
  // #tags layer, positioned per frame by updateStationLabels.
  function buildStationLabels(ride, coords) {
    if (!tags || typeof document === "undefined") return;
    const seen = new Set();
    for (const leg of ride.legs) {
      (leg.stopIds || []).forEach((sid, i) => {
        const name = (leg.stops || [])[i] || "";
        const c = coords.get(sid);
        if (!name || !c || seen.has(name)) return;
        seen.add(name);
        const el = document.createElement("div");
        el.className = "jostation";
        el.textContent = name;
        el.style.display = "none";
        tags.appendChild(el);
        stationLabels.push({ el, pos: toWorld(c, 150) });
      });
    }
  }

  const labelV = new THREE.Vector3();

  function updateStationLabels(camera) {
    const show = group.visible && !!camera;
    const w = (tags && tags.clientWidth) || (typeof innerWidth === "number" ? innerWidth : 0);
    const h = (tags && tags.clientHeight) || (typeof innerHeight === "number" ? innerHeight : 0);
    for (const s of stationLabels) {
      if (!show || !(w > 0 && h > 0)) {
        s.el.style.display = "none";
        continue;
      }
      labelV.copy(s.pos).project(camera);
      if (labelV.z > 1 || labelV.z < -1) {
        s.el.style.display = "none";
        continue;
      }
      s.el.style.display = "block";
      s.el.style.left = `${(labelV.x * 0.5 + 0.5) * w}px`;
      s.el.style.top = `${(-labelV.y * 0.5 + 0.5) * h}px`;
    }
  }

  function hideStationLabels() {
    for (const s of stationLabels) s.el.style.display = "none";
    hideTrainPin();
  }

  // 19e: HTML train pin (constant 20 px by construction, so it can
  // never balloon near the camera). The dot fills with the current leg's
  // congestion colour; the pill reads `${lineName} · ${memberLabel}`.
  const trainV = new THREE.Vector3();
  function ensureTrainPin() {
    if (trainPin || !tags || typeof document === "undefined") return trainPin;
    const root = document.createElement("div");
    root.className = "trainpin";
    const dot = document.createElement("span");
    dot.className = "trainpin-dot";
    const labelEl = document.createElement("span");
    labelEl.className = "trainpin-label";
    root.appendChild(dot);
    root.appendChild(labelEl);
    root.style.display = "none";
    tags.appendChild(root);
    trainPin = { root, dot, labelEl };
    return trainPin;
  }
  function hideTrainPin() {
    if (trainPin) trainPin.root.style.display = "none";
  }
  function setTrain(ride, elapsed, camera, memberLabel) {
    if (!ride || !network) {
      hideTrainPin();
      return null;
    }
    const pos = trainPosition(network, ride, elapsed);
    if (!pos) {
      hideTrainPin();
      return null;
    }
    const pin = ensureTrainPin();
    if (!pin || !camera) {
      hideTrainPin();
      return pos;
    }
    const w = (tags && tags.clientWidth) || (typeof innerWidth === "number" ? innerWidth : 0);
    const h = (tags && tags.clientHeight) || (typeof innerHeight === "number" ? innerHeight : 0);
    if (!(w > 0 && h > 0)) {
      hideTrainPin();
      return pos;
    }
    trainV.copy(toWorld([pos.lon, pos.lat], 90)).project(camera);
    if (trainV.z > 1 || trainV.z < -1) {
      hideTrainPin();
      return pos;
    }
    const x = (trainV.x * 0.5 + 0.5) * w;
    const y = (-trainV.y * 0.5 + 0.5) * h;
    if (x < 0 || x > w || y < 0 || y > h) {
      hideTrainPin();
      return pos;
    }
    const leg = ride.legs[pos.legIndex] || ride.legs[0] || {};
    const pct = leg.congestion ? leg.congestion.valuePct : fallbackPct;
    pin.dot.style.background =
      `#${BAND_COLORS[congestionBand(pct).key].toString(16).padStart(6, "0")}`;
    pin.labelEl.textContent = memberLabel ? `${leg.lineName} · ${memberLabel}` : (leg.lineName || "");
    pin.root.style.display = "flex";
    pin.root.style.left = `${x}px`;
    pin.root.style.top = `${y}px`;
    return pos;
  }

  // 17c/19e: distance-scaled station dots (call every frame while the
  // journey is visible): dots clamp to 14 px, legible from street level
  // to the cruise without hiding the road. The train is an HTML pin now
  // (constant size), so only the dots rescale here.
  const markerDummy = new THREE.Object3D();
  function updateMarkerScale(camera, viewHpx) {
    if (!camera || !group.visible) return;
    const fov = Number(camera.fov) || 10;
    const vh = Number(viewHpx) || 800;
    if (dotMesh && dotHull && dotWorld.length > 0) {
      dotWorld.forEach((p, i) => {
        const s = markerScaleFor(camera.position.distanceTo(p), fov, vh,
          DOT_DIAM, STATION_DOT_PX);
        markerDummy.position.copy(p);
        markerDummy.scale.setScalar(s);
        markerDummy.updateMatrix();
        dotMesh.setMatrixAt(i, markerDummy.matrix);
        markerDummy.scale.setScalar(s * DOT_HULL);
        markerDummy.updateMatrix();
        dotHull.setMatrixAt(i, markerDummy.matrix);
      });
      dotMesh.instanceMatrix.needsUpdate = true;
      dotHull.instanceMatrix.needsUpdate = true;
    }
  }

  // 36c: register the corridor aerial drape. setManifest calls it
  // with the new manifest bounds; the plane stays painted on failure.
  function drapeCorridor(fn) {
    drapeHook = typeof fn === "function" ? fn : null;
  }

  // 36c2: corridor buildings as one two-group mesh — walls (group 0,
  // today's material) then roofs (group 1: the aerial texture once the
  // corridor drape lands, else the wall material exactly as today).
  function buildCorridorBuildings(soup) {
    const { roofIdx, wallIdx } = splitRoofWall(soup.positions, soup.normals);
    const order = wallIdx.concat(roofIdx);
    const n = order.length;
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    for (let dst = 0; dst < n; dst++) {
      const src = order[dst];
      positions[dst * 3] = soup.positions[src * 3];
      positions[dst * 3 + 1] = soup.positions[src * 3 + 1];
      positions[dst * 3 + 2] = soup.positions[src * 3 + 2];
      normals[dst * 3] = soup.normals[src * 3];
      normals[dst * 3 + 1] = soup.normals[src * 3 + 1];
      normals[dst * 3 + 2] = soup.normals[src * 3 + 2];
      colors[dst * 3] = soup.colors[src * 3];
      colors[dst * 3 + 1] = soup.colors[src * 3 + 1];
      colors[dst * 3 + 2] = soup.colors[src * 3 + 2];
      if (dst >= wallIdx.length && corridorMosaic) {
        const [lon, lat] = xyToLonLat(soup.positions[src * 3],
          -soup.positions[src * 3 + 2], origin);
        const [u, v] = uvForLonLat(lon, lat,
          corridorMosaic.range, corridorMosaic.zoom);
        uvs[dst * 2] = u;
        uvs[dst * 2 + 1] = v;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.addGroup(0, wallIdx.length, 0);
    geo.addGroup(wallIdx.length, roofIdx.length, 1);
    const mesh = new THREE.Mesh(geo,
      [buildingMat, corridorMosaic ? roofAerialMat : buildingMat]);
    mesh.userData.corridorRoof = true;
    mesh.userData.corridorWallCount = wallIdx.length;
    return mesh;
  }

  // 36c2: the corridor drape landed (possibly after tiles) — point
  // every tile roof at the aerial texture and fill roof UVs over the
  // mosaic range. Tiles loaded later use the stored mosaic directly.
  function applyCorridorMosaic() {
    if (!corridorMosaic) return;
    roofAerialMat.map = corridorMosaic.texture;
    roofAerialMat.needsUpdate = true;
    for (const slot of tiles.values()) {
      for (const m of slot.meshes) {
        if (!m || !m.userData.corridorRoof) continue;
        const pos = m.geometry.attributes.position;
        const uv = m.geometry.attributes.uv;
        const wallCount = m.userData.corridorWallCount || 0;
        for (let i = wallCount; i < pos.count; i++) {
          const [lon, lat] = xyToLonLat(pos.getX(i), -pos.getZ(i), origin);
          const [u, v] = uvForLonLat(lon, lat,
            corridorMosaic.range, corridorMosaic.zoom);
          uv.setXY(i, u, v);
        }
        uv.needsUpdate = true;
        m.material = [buildingMat, roofAerialMat];
      }
    }
  }

  function setCorridorMosaic(mosaic) {
    if (!mosaic || !mosaic.texture || !mosaic.range) return;
    corridorMosaic = { texture: mosaic.texture, range: mosaic.range, zoom: mosaic.zoom };
    applyCorridorMosaic();
  }

  function setManifest(m) {
    if ((m && m.id) === (manifest && manifest.id)) return;
    if (preload) {
      preload.cancelled = true;
      preload = null;
    }
    unloadAllTiles();
    manifest = m || null;
    corridorMosaic = null; // the next drape brings its own range
    buildBaseMap();
    if (manifest && manifest.bounds && drapeHook) {
      try {
        const p = drapeHook(manifest.bounds, groundMesh);
        if (p && typeof p.then === "function") {
          p.then((r) => {
            if (r && r.ok && r.texture && r.range) {
              setCorridorMosaic({ texture: r.texture, range: r.range, zoom: r.zoom });
            }
          }).catch(() => {
            // Painted fallback: the land-coloured plane stays as it is.
          });
        }
      } catch {
        // Painted fallback: the land-coloured plane stays as it is.
      }
    }
  }

  function tileProgress() {
    return { loaded: tiles.size, total: tileCapFor(manifest) };
  }

  function countTriangles() {
    let tris = 0;
    for (const slot of tiles.values()) {
      for (const m of slot.meshes) {
        const pos = m.geometry && m.geometry.attributes.position;
        if (!pos) continue;
        tris += m.isLineSegments ? 0 : Math.floor(pos.count / 3);
      }
    }
    for (const acc of [roadAcc, waterOpenAcc]) {
      if (acc) tris += Math.floor(acc.positions.length / 9);
    }
    return tris;
  }

  // Load every tile of the active corridor in the background (small
  // concurrency), independent of the sim clock. Idempotent per corridor:
  // repeat calls attach their progress listener to the running (or
  // finished) preload instead of refetching. Resolves
  // {loaded, total, triangles, cancelled}.
  function preloadCorridor(fetchJson, onProgress) {
    const total = tileCapFor(manifest);
    if (!manifest || total === 0) {
      const done = { loaded: tiles.size, total: 0, triangles: 0, cancelled: false };
      if (onProgress) {
        try {
          onProgress({ loaded: done.loaded, total: 0 });
        } catch { /* listener errors never break the load */ }
      }
      return Promise.resolve(done);
    }
    if (preload && preload.key === manifest.id) {
      if (onProgress) {
        preload.listeners.add(onProgress);
        try {
          onProgress(tileProgress());
        } catch { /* listener errors never break the load */ }
      }
      return preload.promise;
    }
    const plan = corridorLoadPlan(manifest, { loaded: [...tiles.keys()] });
    const listeners = new Set();
    if (onProgress) listeners.add(onProgress);
    const report = () => {
      const s = tileProgress();
      for (const fn of [...listeners]) {
        try {
          fn(s);
        } catch { /* listener errors never break the load */ }
      }
    };
    const state = { key: manifest.id, listeners, cancelled: false, promise: null };
    state.promise = (async () => {
      report();
      let idx = 0;
      const n = Math.min(PRELOAD_CONCURRENCY, Math.max(1, plan.ids.length));
      const workers = Array.from({ length: n }, async () => {
        while (!state.cancelled) {
          const i = idx++;
          if (i >= plan.ids.length) return;
          try {
            const tile = await fetchJson(
              assetUrl(`/data/region/corridor/${manifest.id}/tiles/${plan.ids[i]}.json`));
            if (!state.cancelled) addTile(tile);
          } catch {
            // A missing tile never breaks the journey; the line still draws.
          }
          if (!state.cancelled) report();
        }
      });
      await Promise.all(workers);
      return { loaded: tiles.size, total, triangles: countTriangles(),
        cancelled: state.cancelled };
    })();
    preload = state;
    return state.promise;
  }

  // Back-compat paced entry: now just ensures the background preload is
  // running and reports its progress (the clock no longer paces tiles).
  async function updateTiles(focus, fetchJson) {
    if (!manifest) return { loaded: tiles.size, pending: 0 };
    if (typeof fetchJson === "function") preloadCorridor(fetchJson, null);
    const p = tileProgress();
    return { loaded: p.loaded, pending: Math.max(0, p.total - p.loaded) };
  }

  function addTile(tile) {
    if (!tile || tiles.has(tile.id)) return;
    const meshes = [];
    const soup = tileBuildings(tile, origin);
    if (soup.triangles > 0) {
      const mesh = buildCorridorBuildings(soup);
      mesh.frustumCulled = false;
      meshes.push(mesh);
    }
    const lines = tileLines(tile, origin);
    if (lines.segments > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(lines.positions, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(lines.colors, 3));
      const mesh = new THREE.LineSegments(geo, lineMat);
      mesh.frustumCulled = false;
      meshes.push(mesh);
    }
    const water = tileWater(tile, origin, rgbWater);
    if (water.triangles > 0) {
      const mesh = new THREE.Mesh(soupGeometry(water), waterMat);
      mesh.frustumCulled = false;
      meshes.push(mesh);
    }
    for (const m of meshes) tileGroup.add(m);
    tiles.set(tile.id, { meshes });
    // Corridor-wide merged ribbons (major roads + open waterways at a
    // readable width), rebuilt as tiles arrive.
    const roads = tileRoadRibbons(tile, origin, { color: rgbRoad });
    if (roads.triangles > 0 && roadAcc) {
      roadAcc.positions.push(...roads.positions);
      roadAcc.normals.push(...roads.normals);
      roadAcc.colors.push(...roads.colors);
    }
    const openWater = tileWaterRibbons(tile, origin, { color: rgbWater });
    if (openWater.triangles > 0 && waterOpenAcc) {
      waterOpenAcc.positions.push(...openWater.positions);
      waterOpenAcc.normals.push(...openWater.normals);
      waterOpenAcc.colors.push(...openWater.colors);
    }
    rebuildMerged();
  }

  function pathBounds() {
    if (!lineMesh) return null;
    lineMesh.geometry.computeBoundingBox();
    return lineMesh.geometry.boundingBox;
  }

  function counts() {
    return { tiles: tiles.size, total: tileCapFor(manifest), rideKey,
      visible: group.visible };
  }

  function setVisible(v) {
    group.visible = v;
    if (!v) hideStationLabels();
  }

  function dispose() {
    if (preload) {
      preload.cancelled = true;
      preload = null;
    }
    clearPath();
    unloadAllTiles();
    resetBaseMap();
    scene.remove(group);
  }

  resetBaseMap();

  return { setPath, setTrain, setManifest, drapeCorridor, setCorridorMosaic, updateTiles, preloadCorridor,
    tileProgress, updateStationLabels, updateMarkerScale, pathBounds,
    counts, setVisible, dispose, group };
}
