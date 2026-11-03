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
import { runHouseholdLoop } from "./judge/household.js";
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
  // 41g: region-us ships no congestion file — the region dir decides,
  // so US runs never request (404) data/region-us/congestion.json.
  const files = dir === "region-us"
    ? [["network", "network.json"]]
    : [["network", "network.json"], ["congestion", "congestion.json"]];
  const region = { congestion: null };
  for (const [key, file] of files) {
    try {
      region[key] = await fetchJson(assetUrl(`/data/${dir}/${file}`));
    } catch {
      region[key] = null;
    }
  }
  if (!region.network && !region.congestion) return null;
  return region;
}

// 44b: Muse decisions arrive one branch at a time. With
// decisionMode:'muse' the worker runs the household loop and emits
// {decisionRequest:{requestId, context}} per branch, awaiting the
// matched main-thread answer. Main-thread answers
// ({decisionAnswer:{requestId, entry}} or
// {decisionError:{requestId, error}}) resolve the pending branch only
// — they never start a run. A decision error stops the whole run;
// the month is never quietly continued by rules. Keys never enter
// worker messages or outputs: the main thread keeps them.
let seq = 0;
const pendingDecisions = new Map();
let running = false;

function askMain(post, context) {
  const requestId = `d${seq++}`;
  post({ decisionRequest: { requestId, context } });
  return new Promise((resolve, reject) => {
    pendingDecisions.set(requestId, { resolve, reject });
  });
}

self.onmessage = async (e) => {
  const d = e.data || {};
  const post = (msg) => self.postMessage(msg);
  if (d && (d.decisionAnswer || d.decisionError)) {
    const msg = d.decisionAnswer || d.decisionError;
    const waiter = msg && pendingDecisions.get(msg.requestId);
    pendingDecisions.delete(msg && msg.requestId);
    if (waiter) {
      if (d.decisionAnswer) waiter.resolve(d.decisionAnswer.entry);
      else waiter.reject(new Error(String((msg && msg.error) || "decision failed")));
    }
    return; // an answer is never a new run
  }
  if (running) {
    post({ ok: false, error: "sim worker busy" });
    return;
  }
  running = true;
  try {
    const { scenario: name, scenarioInline, labels, decisionMode } = d;
    const scen = scenarioInline || await fetchJson(assetUrl(`/scenarios/${name}.json`));
    const region = await loadRegion(scen.homes);
    const runs = {};
    const list = Array.isArray(labels) ? labels : [];
    const muse = decisionMode === "muse";
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
      if (!muse) {
        runs[label] = simulate(area, structuredClone(scen), label,
          { ...(region ? { region } : {}), ...(destArea ? { destArea } : {}) });
      } else {
        const judged = await runHouseholdLoop({
          area,
          scenarioRaw: structuredClone(scen),
          homeLabel: label,
          ...(region ? { region } : {}),
          ...(destArea ? { destArea } : {}),
          judgeOne: ({ ctx }) => askMain(post, ctx),
          onProgress: (info) => post({
            ok: true,
            progress: { done: i, total: list.length, label, decision: info },
          }),
        });
        runs[label] = judged.run;
      }
      post({ ok: true, progress: { done: i + 1, total: list.length, label } });
    }
    post({ ok: true, runs });
  } catch (err) {
    post({ ok: false, error: String((err && err.message) || err) });
  } finally {
    pendingDecisions.clear();
    running = false;
  }
};
