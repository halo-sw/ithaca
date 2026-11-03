import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { STATION_CATS } from "../src/engine/places.js";
import { normalizeStation } from "../src/engine/journey.js";
import { pathToFileURL } from "node:url";
import { createHomesLoader, createUsHomesLoader } from "../src/consult/server.js";
import { parseInterstationCsv } from "../src/transit/schedule.js";
import { createSession, callTool } from "../src/consult/tools.js";
import { rideMinutesForHome } from "../src/engine/scenario.js";
import { stationCoords } from "../src/engine/workplace.js";
import { defaultSeeds } from "../src/engine/paired.js";
import { householdMembers, oneWayCommuteOfRun } from "../src/verify/numbers.js";

export function haversineM(lon1, lat1, lon2, lat2) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function listingWalkMin(distM, mPerMin) {
  return Math.round((distM / mPerMin) * 10) / 10;
}

const round1 = (x) => Math.round(x * 10) / 10;

export function commuteParts(run) {
  const kept = [];
  for (const member of householdMembers(run)) {
    const halves = new Set();
    for (const t of (run && run.trips) || []) {
      if (!t || t.purpose !== "commute" || t.agent !== member) continue;
      const tm = t.depart_min ?? t.arrive_min ?? 0;
      halves.add(`${t.day}|${tm < 720 ? "am" : "pm"}`);
    }
    for (const a of (run && run.aways) || []) {
      if (!a || a.kind !== "ride" || a.agent !== member) continue;
      const tm = a.start_min ?? a.end_min ?? 0;
      halves.add(`${a.day}|${tm < 720 ? "am" : "pm"}`);
    }
    if (halves.size === 0) continue;
    const pm = run && run.totals && run.totals.per_member
      && run.totals.per_member[member];
    const walk = pm ? pm.commute_walk_minutes : undefined;
    const ride = pm ? pm.commute_ride_minutes : undefined;
    const wait = pm ? pm.commute_wait_minutes : undefined;
    if (!Number.isFinite(walk) || !Number.isFinite(ride) || !Number.isFinite(wait)) continue;
    kept.push({ walk: walk / halves.size, ride: ride / halves.size, wait: wait / halves.size });
  }
  if (kept.length === 0) return null;
  const avg = (f) => round1(kept.reduce((s, p) => s + p[f], 0) / kept.length);
  return { walk: avg("walk"), ride: avg("ride"), wait: avg("wait") };
}

export function summarizeDiffs(rows) {
  const counted = rows.filter((r) => Number.isFinite(r.diff_min));
  const excluded = rows.filter((r) => r.diff_min === null).length;
  const partsMean = (key) => {
    const vals = counted.map((r) => r[key]).filter((v) => Number.isFinite(v));
    if (vals.length === 0) return null;
    return round1(vals.reduce((s, v) => s + v, 0) / vals.length);
  };
  const parts_mean = {
    walk: partsMean("engine_walk_min"),
    ride: partsMean("engine_ride_min"),
    wait: partsMean("engine_wait_min"),
  };
  if (counted.length === 0) {
    return { n: 0, excluded, mean: null, median: null, min: null, max: null, share_listing_lower: null, parts_mean };
  }
  const diffs = counted.map((r) => r.diff_min).sort((a, b) => a - b);
  const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  const mid = Math.floor(diffs.length / 2);
  const median = diffs.length % 2 === 1 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
  const lower = counted.filter((r) => r.commute_listing_min < r.commute_engine_min).length;
  return {
    n: counted.length,
    excluded,
    mean: round1(mean),
    median: round1(median),
    min: round1(diffs[0]),
    max: round1(diffs[diffs.length - 1]),
    share_listing_lower: Math.round((lower / counted.length) * 100) / 100,
    parts_mean,
  };
}

function homeLonLat(home) {
  if (Array.isArray(home.coords) && home.coords.length >= 2) return [home.coords[0], home.coords[1]];
  if (Number.isFinite(home.lon) && Number.isFinite(home.lat)) return [home.lon, home.lat];
  return null;
}

function asLonLat(p) {
  if (Array.isArray(p) && p.length >= 2) return [p[0], p[1]];
  if (p && Number.isFinite(p.lon) && Number.isFinite(p.lat)) return [p.lon, p.lat];
  return null;
}

export function stationPointFromArea(area, stationName, homeLonLat) {
  if (!area || stationName === null || stationName === undefined) return null;
  if (!Array.isArray(homeLonLat) || homeLonLat.length < 2) return null;
  const [hlon, hlat] = homeLonLat;
  if (!Number.isFinite(hlon) || !Number.isFinite(hlat)) return null;
  const want = normalizeStation(stationName);
  const pois = Array.isArray(area.pois) ? area.pois : [];
  let best = null;
  let bestD = Infinity;
  for (const p of pois) {
    if (!p || !STATION_CATS.has(p.category)) continue;
    if (normalizeStation(p.name) !== want) continue;
    const coords = p.geometry && p.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const d = haversineM(hlon, hlat, lon, lat);
    if (d < bestD) {
      bestD = d;
      best = [lon, lat];
    }
  }
  return best;
}

export function buildRow({ set, cand, home, stationLonLat, rideMin, engineValues, engineParts }) {
  const id = (cand && cand.id) ?? (home && home.id) ?? null;
  const name = (cand && cand.name) ?? (home && home.name) ?? null;
  const stationName = (home && home.station && home.station.station) ?? (cand && cand.station) ?? null;
  const graphMin = (home && home.station && home.station.walk_minutes) ?? null;
  const fail = (reason, ride) => ({
    set, id, name, station: stationName, straight_m: null,
    station_walk_listing_min: null, station_walk_listing_min_67: null,
    station_walk_graph_min: graphMin ?? null, ride_min: ride ?? null,
    commute_listing_min: null, commute_engine_min: null, engine_runs: 0,
    engine_walk_min: null, engine_ride_min: null, engine_wait_min: null,
    diff_min: null, reason,
  });
  try {
    if (rideMin === null || rideMin === undefined || !Number.isFinite(rideMin)) {
      return fail("no rail leg in the engine trip");
    }
    const st = asLonLat(stationLonLat);
    const hl = home ? homeLonLat(home) : null;
    if (!st || !hl || !stationName) {
      return fail("station point not found", rideMin);
    }
    const straight = haversineM(hl[0], hl[1], st[0], st[1]);
    const walkListing = listingWalkMin(straight, 80);
    const walk67 = listingWalkMin(straight, 67);
    const listing = round1(walkListing + rideMin);
    const finite = (engineValues ?? []).filter((v) => Number.isFinite(v));
    if (finite.length === 0) {
      return { ...fail("build_scenario failed: no successful engine runs", rideMin), station: stationName };
    }
    const engineMin = round1(finite.reduce((s, v) => s + v, 0) / finite.length);
    const partsMean = (key) => {
      const vals = (engineParts ?? []).filter((p) => p && Number.isFinite(p[key])).map((p) => p[key]);
      if (vals.length === 0) return null;
      return round1(vals.reduce((s, v) => s + v, 0) / vals.length);
    };
    return {
      set, id, name, station: stationName, straight_m: round1(straight),
      station_walk_listing_min: walkListing, station_walk_listing_min_67: walk67,
      station_walk_graph_min: graphMin ?? null, ride_min: rideMin,
      commute_listing_min: listing, commute_engine_min: engineMin, engine_runs: finite.length,
      engine_walk_min: partsMean("walk"), engine_ride_min: partsMean("ride"), engine_wait_min: partsMean("wait"),
      diff_min: round1(engineMin - listing), reason: null,
    };
  } catch (err) {
    return fail(`build_scenario failed: ${String((err && err.message) || err).slice(0, 200)}`);
  }
}

// Copied from server.js (not exported there): fs-backed readers over a
// local root ("data" or "scen" plus a relative path).
async function loadAreaFs(readText, areaCache, areaId) {
  if (areaCache.has(areaId)) return areaCache.get(areaId);
  const area = JSON.parse(await readText("data", `${areaId}/area.json`));
  for (const [key, value] of Object.entries(area)) {
    if (value && typeof value === "object" && !Array.isArray(value)
        && Object.keys(value).join() === "$ref") {
      area[key] = JSON.parse(await readText("data", `${areaId}/${value.$ref}`));
    }
  }
  areaCache.set(areaId, area);
  return area;
}

async function loadAreaMetaFs(readText, areaMetaCache, areaId) {
  if (areaMetaCache.has(areaId)) return areaMetaCache.get(areaId);
  const doc = JSON.parse(await readText("data", `${areaId}/area.json`));
  const meta = { bbox: doc.bbox || null };
  areaMetaCache.set(areaId, meta);
  return meta;
}

async function loadRegionFs(readText, areaIds = null) {
  const areas = Array.isArray(areaIds) ? areaIds.filter(Boolean).map(String) : [];
  const dir = areas.length > 0 && areas.every((a) => a.startsWith("us-")) ? "region-us" : "region";
  const region = {};
  for (const [key, file] of [["network", "network.json"], ["congestion", "congestion.json"]]) {
    try {
      region[key] = JSON.parse(await readText("data", `${dir}/${file}`));
    } catch {
      region[key] = null;
    }
  }
  if (!region.network && !region.congestion) return null;
  return region;
}

function parseArgs(argv) {
  const out = { dataDir: null, scenDir: "scenarios", out: "docs/evidence/baseline-commute.json" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data-dir") out.dataDir = argv[++i];
    else if (argv[i] === "--scen-dir") out.scenDir = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}

async function main() {
  const { dataDir, scenDir, out } = parseArgs(process.argv.slice(2));
  if (!dataDir) throw new Error("usage: baseline-commute.mjs --data-dir <dir> [--scen-dir scenarios] [--out docs/evidence/baseline-commute.json]");
  const read = async (root, rel) => {
    const base = root === "data" ? dataDir : scenDir;
    try {
      return await readFile(join(base, rel), "utf8");
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
      const buf = await readFile(join(base, `${rel}.gz`));
      return gunzipSync(buf).toString("utf8");
    }
  };
  const areaCache = new Map();
  const areaMetaCache = new Map();
  const loadArea = (areaId) => loadAreaFs(read, areaCache, areaId);
  const loadAreaMeta = (areaId) => loadAreaMetaFs(read, areaMetaCache, areaId);
  const loadRegion = (areaIds) => loadRegionFs(read, areaIds);
  const loadHomes = createHomesLoader(read);
  const loadUsHomes = createUsHomesLoader(read);
  let areasIndexCache = null;
  const loadAreasIndex = async () => {
    if (!areasIndexCache) areasIndexCache = JSON.parse(await read("data", "areas-index.json"));
    return areasIndexCache;
  };
  let stationBoxesCache = null;
  const loadStationBoxes = async () => {
    if (!stationBoxesCache) stationBoxesCache = JSON.parse(await read("data", "station-boxes.json"));
    return stationBoxesCache;
  };
  let transitCache = null;
  const loadTransit = async () => {
    if (!transitCache) transitCache = parseInterstationCsv(await read("scen", "transit/seoul-metro-interstation.csv"));
    return transitCache;
  };

  const sets = { K1: "seoul-couple.json", K2: "pangyo-reviewed-month.json", U: "menlo-month.json" };
  const scriptDir = new URL(".", import.meta.url).pathname;
  const rows = [];
  let paramSeeds = null;
  for (const [set, file] of Object.entries(sets)) {
    const record = JSON.parse(await readFile(join(scriptDir, "../public/recorded", file), "utf8"));
    const cands = (((record.candidatesData || {}).result || {}).candidates) || [];
    const session = createSession({ scenario: record.scenario, context: { profile: record.profile },
      loadArea, loadAreaMeta, loadRegion, loadHomes, loadUsHomes,
      loadAreasIndex, loadStationBoxes, loadTransit });
    for (const cand of cands) {
      const b = await callTool(session, "build_scenario", { profile: record.profile, home_ids: [cand.id] });
      if (!b.ok) {
        rows.push({ set, id: cand.id, name: cand.name ?? null, station: null, straight_m: null,
          station_walk_listing_min: null, station_walk_listing_min_67: null, station_walk_graph_min: null,
          ride_min: null, commute_listing_min: null, commute_engine_min: null, engine_runs: 0,
          engine_walk_min: null, engine_ride_min: null, engine_wait_min: null,
          diff_min: null, reason: `build_scenario failed: ${(b.errors || [b.error]).flat().join("; ").slice(0, 200)}` });
        continue;
      }
      const index = await loadHomes();
      const usIndex = await loadUsHomes();
      const all = [...(Array.isArray(index) ? index : (index.homes || [])),
        ...(Array.isArray(usIndex) ? usIndex : (usIndex.homes || []))];
      const home = all.find((h) => h.id === cand.id) || null;
      const member = (session.scenario.household.members || []).find((m) => m.work && m.work.type === "station_ride") || null;
      const rideMin = member ? rideMinutesForHome(member.work, "A") : null;
      let stationName = null;
      if (member && member.work && member.work.station_name !== null && member.work.station_name !== undefined) {
        const sn = member.work.station_name;
        stationName = (sn && typeof sn === "object" ? sn.A : sn) ?? null;
      }
      let stationLonLat = null;
      if (stationName !== null && stationName !== undefined && home && home.scene) {
        try {
          stationLonLat = stationPointFromArea(await loadArea(home.scene), stationName, [home.lon, home.lat]);
        } catch {
          stationLonLat = null;
        }
        if (!stationLonLat) {
          const region = await loadRegion([home.scene]).catch(() => null);
          const hit = region && region.network ? stationCoords(region.network, stationName) : null;
          if (hit) stationLonLat = [hit.lon, hit.lat];
        }
      }
      const engineValues = [];
      const engineParts = [];
      if (rideMin !== null && rideMin !== undefined && stationLonLat) {
        const seeds = defaultSeeds(session.scenario);
        if (!paramSeeds) paramSeeds = seeds;
        for (const seed of seeds) {
          session.scenario = { ...session.scenario, seed };
          const r = await callTool(session, "run_simulation", { home: "A", decisions: "rules" });
          const hit = r.ok ? session.cache.runs.get(r.run_ids.A) : null;
          engineValues.push(hit ? oneWayCommuteOfRun(hit.run) : null);
          engineParts.push(hit ? commuteParts(hit.run) : null);
          if (hit) session.cache.runs.delete(r.run_ids.A);
        }
      } else if (!paramSeeds) {
        paramSeeds = defaultSeeds(session.scenario);
      }
      rows.push(buildRow({ set, cand, home, stationLonLat, rideMin, engineValues, engineParts }));
    }
  }
  const summary = {
    K1: summarizeDiffs(rows.filter((r) => r.set === "K1")),
    K2: summarizeDiffs(rows.filter((r) => r.set === "K2")),
    U: summarizeDiffs(rows.filter((r) => r.set === "U")),
    K: summarizeDiffs(rows.filter((r) => r.set === "K1" || r.set === "K2")),
  };
  const doc = { stage: "60a",
    params: { listing_m_per_min: 80, sensitivity_m_per_min: 67, engine_walk_m_per_min: 78,
      seeds: paramSeeds || [], decider: "rules", data_dir: basename(dataDir), sets },
    rows, summary };
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  for (const [set, s] of Object.entries(summary)) {
    console.log(`${set} n=${s.n} mean=${s.mean} median=${s.median} min=${s.min} max=${s.max} listing_lower=${s.share_listing_lower} excluded=${s.excluded}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(String((err && err.message) || err)); process.exit(1); });
}
