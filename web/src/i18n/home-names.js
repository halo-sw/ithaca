import { romanizeName } from "./romanize.js";

const HANGUL_RE = /[가-힣]/;
const EN_PART_RE = /[A-Za-z0-9'.&\- ]+/;

let map = new Map();
let version = 0;
const listeners = new Set();

const STORAGE_KEY = "ithaca.homeNamesEn.v1";
const MAX_ENTRIES = 500;
let storageLoaded = false;
let storageListening = false;

function notify() {
  version++;
  for (const fn of listeners) {
    try { fn(version); } catch { /* ignore */ }
  }
}

function getStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s || typeof s.getItem !== "function") return null;
    return s;
  } catch { return null; }
}

function readStoredObject() {
  const s = getStorage();
  if (!s) return null;
  let raw = null;
  try { raw = s.getItem(STORAGE_KEY); } catch { return null; }
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch { return null; }
}

function writeStored() {
  const s = getStorage();
  if (!s || typeof s.setItem !== "function") return;
  try { s.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map.entries()))); } catch { /* memory only */ }
}

function capEntries() {
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function ensureLoaded() {
  if (storageLoaded) return;
  storageLoaded = true;
  const stored = readStoredObject();
  if (!stored) return;
  for (const [k, v] of Object.entries(stored)) {
    const key = normKey(k);
    const val = cleanEn(v);
    if (!key || !val) continue;
    if (!map.has(key)) map.set(key, val);
  }
  capEntries();
}

function ensureStorageListener() {
  if (storageListening) return;
  let w = null;
  try { w = typeof window !== "undefined" ? window : null; } catch { w = null; }
  if (!w || typeof w.addEventListener !== "function") return;
  storageListening = true;
  w.addEventListener("storage", (e) => {
    try {
      if (!e || (e.key != null && e.key !== STORAGE_KEY)) return;
      let parsed = null;
      if (e.newValue != null && e.newValue !== "") {
        try { parsed = JSON.parse(e.newValue); } catch { return; }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      }
      storageLoaded = true;
      map = new Map();
      if (parsed) {
        for (const [k, v] of Object.entries(parsed)) {
          const key = normKey(k);
          const val = cleanEn(v);
          if (!key || !val) continue;
          map.set(key, val);
        }
      }
      capEntries();
      notify();
    } catch { /* ignore */ }
  });
}

ensureStorageListener();

function normKey(ko) {
  return String(ko ?? "").trim();
}

function cleanEn(v) {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (HANGUL_RE.test(s)) return "";
  return s;
}

export function homeNameEn(ko) {
  ensureLoaded();
  const k = normKey(ko);
  if (!k) return "";
  if (map.has(k)) return map.get(k);
  return romanizeName(k);
}

export function registerHomeNamesEn(obj) {
  ensureLoaded();
  if (!obj || typeof obj !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(obj)) {
    const key = normKey(k);
    const val = cleanEn(v);
    if (!key || !val) continue;
    if (map.get(key) !== val) {
      map.delete(key);
      map.set(key, val);
      n++;
    }
  }
  if (n > 0) {
    capEntries();
    writeStored();
    notify();
  }
  return n;
}

const STOP_WORDS = new Set([
  "and", "are", "is", "the", "a", "an", "both", "from", "in", "of", "to",
  "with", "near", "at", "for", "as", "on",
]);

const SENTENCE_PUNCT_RE = /[,;:!?]/;

export function harvestHomeNamesEn(text, knownKoNames) {
  const out = {};
  if (!text || !knownKoNames) return out;
  const known = new Set(
    (Array.isArray(knownKoNames) ? knownKoNames : [...(knownKoNames || [])])
      .map((s) => String(s ?? "").trim())
      .filter(Boolean),
  );
  if (known.size === 0) return out;
  const str = String(text);
  // Find each (한글) group and look backwards for the Latin run.
  const parenRe = /\(([^()]*)\)/g;
  let m;
  while ((m = parenRe.exec(str)) !== null) {
    const inside = String(m[1] || "").trim();
    if (!known.has(inside)) continue;
    const before = str.slice(0, m.index);
    const tail = EN_PART_RE.exec(
      before.split(/\n/).pop() ?? "",
    );
    let run = tail ? tail[0] : "";
    // EN_PART_RE is not anchored; take the trailing run.
    const runs = before.match(/[A-Za-z0-9'.&\-]+(?: +[A-Za-z0-9'.&\-]+)*/g);
    run = runs && runs.length > 0 ? runs[runs.length - 1] : "";
    if (!run) continue;
    // Cut at sentence punctuation: keep only the segment after the last one.
    const segs = run.split(SENTENCE_PUNCT_RE);
    run = segs[segs.length - 1] || "";
    let words = run.trim().split(/\s+/).filter(Boolean);
    // Drop leading sentence-start/stop words.
    while (words.length > 0 && STOP_WORDS.has(words[0].toLowerCase())) words.shift();
    // Also stop at an embedded stop word boundary: keep the tail after the
    // last stop word when the run swallowed a clause ("... walk from work"
    // cannot happen since only Latin words match, but "and X" can).
    const lower = words.map((w) => w.toLowerCase());
    let cut = -1;
    for (let i = 0; i < lower.length; i++) {
      if (STOP_WORDS.has(lower[i])) cut = i;
    }
    if (cut >= 0) words = words.slice(cut + 1);
    words = words.slice(-5);
    const name = words.join(" ").trim();
    if (!name || HANGUL_RE.test(name)) continue;
    out[inside] = name;
  }
  return out;
}

export function homeNamesEnSnapshot() {
  ensureLoaded();
  return Object.fromEntries(map.entries());
}

export function resetHomeNamesEn() {
  map = new Map();
  storageLoaded = true;
  try {
    const s = getStorage();
    if (s && typeof s.removeItem === "function") s.removeItem(STORAGE_KEY);
  } catch { /* memory only */ }
  version++;
}

export function dropHomeNamesEnMemoryForTests() {
  map = new Map();
  storageLoaded = false;
}

export function homeNamesEnVersion() {
  return version;
}

export function subscribeHomeNamesEn(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
