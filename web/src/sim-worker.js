// Sim fallback worker: runs the life engine off the main thread.
//
// When the CLI output (/data/sim/<scenario>-<label>.json) is missing,
// the page asks this worker to simulate the requested homes instead.
// Same engine modules as the CLI, so file and worker runs agree
// byte-for-byte for the same inputs.
//
// 12b: also accepts an inline scenario ({scenarioInline, labels}) for
// chat-picked homes, with per-home progress posts
// ({progress: {done, total, label}}). Callers must ignore progress
// posts (they carry no runs).
import { simulate } from "./engine/simulate.js";
import { assetUrl } from "./paths.js";
import { fetchDataJson } from "./data-fetch.js";

function fetchJson(url) {
  return fetchDataJson(url);
}

async function loadArea(areaId) {
  const area = await fetchJson(assetUrl(`/data/${areaId}/area.json`));
  for (const [key, value] of Object.entries(area)) {
    if (value && typeof value === "object" && !Array.isArray(value)
        && Object.keys(value).join() === "$ref") {
      area[key] = await fetchJson(assetUrl(`/data/${areaId}/${value.$ref}`));
    }
  }
  return area;
}

// 29N3: a run whose home areas are us-* reads the Caltrain region
// doc (region-us has no congestion file — congestion stays null).
function regionDirFor(homes) {
  const areas = (homes || []).map((h) => h && h.area).filter(Boolean);
  if (areas.length > 0 && areas.every((a) => String(a).startsWith("us-"))) return "region-us";
  return "region";
}

async function loadRegion(homes) {
  const dir = regionDirFor(homes);
  const region = {};
  for (const [key, file] of [["network", "network.json"], ["congestion", "congestion.json"]]) {
    try {
      region[key] = await fetchJson(assetUrl(`/data/${dir}/${file}`));
    } catch {
      region[key] = null;
    }
  }
  if (!region.network && !region.congestion) return null;
  return region;
}

self.onmessage = async (e) => {
  const { scenario: name, scenarioInline, labels } = e.data || {};
  const post = (msg) => self.postMessage(msg);
  try {
    const scen = scenarioInline || await fetchJson(assetUrl(`/scenarios/${name}.json`));
    const region = await loadRegion(scen.homes);
    const runs = {};
    const list = Array.isArray(labels) ? labels : [];
    for (let i = 0; i < list.length; i++) {
      const label = list[i];
      post({ ok: true, progress: { done: i, total: list.length, label } });
      const home = scen.homes.find((h) => h.label === label);
      if (!home) throw new Error(`unknown home ${label}`);
      const area = await loadArea(home.area);
      // 29N3: a US station-box home walks its last mile on the
      // destination box (us-menlo for Meta HQ) — same resolution as
      // the consult server, fetched here so worker runs agree.
      let destArea = null;
      if (String(home.area).startsWith("us-st-")) {
        try {
          destArea = await loadArea("us-menlo");
        } catch {
          destArea = null;
        }
      }
      runs[label] = simulate(area, structuredClone(scen), label,
        { ...(region ? { region } : {}), ...(destArea ? { destArea } : {}) });
      post({ ok: true, progress: { done: i + 1, total: list.length, label } });
    }
    post({ ok: true, runs });
  } catch (err) {
    post({ ok: false, error: String((err && err.message) || err) });
  }
};
