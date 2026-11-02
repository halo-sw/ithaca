// Stage 23a: public relay for the static site (GitHub Pages has no
// server). One Vercel serverless function serves Muse chat and the
// VWorld tiles, keeping every key in its own env, never in the browser.
//
// Keys (META_API_KEY (or MODEL_API_KEY), VWORLD_KEY, HOUSING_API_KEY) are read from env
// only, server-side. They never appear in a response body, a header,
// an error message or a log line. Tiles stream through and are never
// stored (Cache-Control: no-store). Public data is read over HTTP from
// the Pages site; this relay has no data dir and no file-system data.

import { serveTile } from "../web/src/aerial/proxy.js";
import { createStreetHandler } from "./street.js";
import { createConsultHandler, httpReadText, readBody } from "../web/src/consult/server.js";
import { VOICE_MAX_BYTES, createTranscribeHandler } from "../web/src/consult/voice.js";
import { BYOK_HEADER } from "../web/src/consult/byok.js";
import { SESSION_HEADER } from "../web/src/chat/session-id.js";
import { createSessionStore } from "./session-store.js";
// Model endpoints this relay calls with the server key: Meta (META_API_BASE) for chat and voice; Baseten (BASETEN_API_BASE) only with a browser-supplied key.
export { META_API_BASE, BASETEN_API_BASE } from "../web/src/judge/providers.js";
import { metaApiKey } from "../web/src/judge/providers.js";

const DEFAULT_ORIGINS = [
  "https://halo-sw.github.io",
  "http://127.0.0.1:48741",
  "http://localhost:5173",
];
const DEFAULT_DATA_BASE = "https://halo-sw.github.io/ithaca/";
const DAY_MS = 86400000;

function allowedOrigins(env) {
  const raw = env && env.ALLOWED_ORIGINS;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return DEFAULT_ORIGINS.slice();
}

function reqHeader(req, name) {
  const h = req.headers || {};
  return h[name] || h[name.toLowerCase()] || null;
}

function clientKey(req) {
  const fwd = reqHeader(req, "x-forwarded-for");
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim() || "?";
  }
  const sock = req.socket && req.socket.remoteAddress;
  return sock || "?";
}

// Vercel rewrites /api/:path* to /api/relay?path=:path*: read path from
// the query when present, else use req.url's pathname. Normalise to
// /api/<path>.
function relayPath(req) {
  const raw = req.url || "/";
  let pathname = raw;
  let queryPath = null;
  try {
    const u = new URL(raw, "http://relay.local");
    pathname = u.pathname;
    queryPath = u.searchParams.get("path");
  } catch {
    pathname = String(raw).split("?")[0];
  }
  if (queryPath) return "/api/" + String(queryPath).replace(/^\/+/, "");
  if (pathname.startsWith("/api/")) return pathname;
  return "/api/" + pathname.replace(/^\/+/, "");
}

function isTilePath(path) {
  return path === "/api/tiles/status" || path === "/api/aerial/status"
    || path.startsWith("/api/tiles/") || path.startsWith("/api/aerial/");
}

// Fixed-window bucket: returns 0 and records the hit, or the seconds
// until the oldest hit leaves the window when over the limit.
function checkBucket(store, key, t, windowMs, max) {
  let hits = store.get(key);
  if (!hits) {
    hits = [];
    store.set(key, hits);
  }
  while (hits.length > 0 && hits[0] <= t - windowMs) hits.shift();
  if (hits.length >= max) {
    return Math.max(1, Math.ceil((hits[0] + windowMs - t) / 1000));
  }
  hits.push(t);
  return 0;
}

function checkGlobal(global, t, windowMs, max) {
  while (global.length > 0 && global[0] <= t - windowMs) global.shift();
  if (global.length >= max) {
    return Math.max(1, Math.ceil((global[0] + windowMs - t) / 1000));
  }
  global.push(t);
  return 0;
}

// 43a: judges carry a shared code (env JUDGE_CODES) so a room full of
// judges behind one egress IP is never blocked by the one-session rule
// or the per-IP buckets. Codes shorter than 12 chars are ignored; no
// codes means the feature is off. The code never appears in a body,
// a header or a log line.
const JUDGE_HEADER = "x-ithaca-judge";

function judgeCodes(env) {
  const raw = env && env.JUDGE_CODES;
  if (typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length >= 12);
}

// Constant-time compare against each code: lengths first, then a byte
// XOR loop with no early return inside the loop. A wrong or short code
// counts as no code.
function isJudge(req, codes) {
  if (!Array.isArray(codes) || codes.length === 0) return false;
  const raw = reqHeader(req, JUDGE_HEADER);
  if (typeof raw !== "string") return false;
  const given = raw.trim();
  let ok = false;
  for (const code of codes) {
    if (given.length !== code.length) continue;
    let diff = 0;
    for (let i = 0; i < code.length; i++) diff |= given.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}

// 43a: server-key sessions allowed per IP (env SESSIONS_PER_IP, default
// 1, clamped to 1–10). The per-IP consult day bucket scales with it.
function sessionsPerIp(env) {
  const n = env ? parseInt(env.SESSIONS_PER_IP, 10) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, n));
}

export function createRelay({ env = {}, fetchImpl = fetch, now = () => Date.now(), consultFactory = createConsultHandler, sessionStore } = {}) {
  const origins = allowedOrigins(env);
  // One consult handler per relay, not per request (it holds its caches).
  const consultHandler = consultFactory({
    dataDir: null,
    scenDir: null,
    rawDir: null,
    fetchImpl,
    env,
    readText: httpReadText(env.DATA_BASE_URL || DEFAULT_DATA_BASE, fetchImpl),
  });
  const consult10 = new Map();
  const consultDay = new Map();
  const consultGlobal = [];
  // 43a: judge traffic skips the session rule and the per-IP buckets
  // and counts against its own global day bucket instead.
  const consultJudge = [];
  const codes = judgeCodes(env);
  // 41f: Muse Spark Open on the server key has its own global day
  // bucket (150/day) so open-weights traffic never eats the main
  // budget. BYOK baseten calls count here too.
  const consultGlobalBaseten = [];
  // 41e: one server-key chat session per IP — the first session id
  // seen on the server key is remembered for 24 h; a different (or
  // missing) session id from the same IP is refused without a model
  // call. BYOK requests (x-model-key) skip this rule entirely.
  // 41k: the record lives in sessionStore so the rule holds across
  // relay instances (Vercel Runtime Cache); the per-relay in-memory
  // store is the default and the fallback when the shared store fails.
  const memSessions = createSessionStore({ now });
  const sharedSessions = sessionStore || memSessions;

  // True when a server-key request must be refused: the IP already
  // spent its sessions on another (or an unknown) session id.
  // Requests without a session id never record — refused when the
  // IP already used one, allowed otherwise.
  async function serverKeySessionBlocked(client, session) {
    const limit = sessionsPerIp(env);
    let active = sharedSessions;
    let recorded = null;
    try {
      recorded = await active.get(client);
    } catch {
      console.warn("srv-session store get failed; using memory fallback");
      active = memSessions;
      try {
        recorded = await active.get(client);
      } catch {
        return false;
      }
    }
    const list = Array.isArray(recorded) ? recorded : [];
    if (list.includes(session)) return false;
    if (session && list.length < limit) {
      const next = list.concat([session]);
      try {
        await active.set(client, next, 86400);
      } catch {
        console.warn("srv-session store set failed; using memory fallback");
        try {
          await memSessions.set(client, next, 86400);
        } catch {
          // Memory writes never throw; never block on store errors.
        }
      }
      return false;
    }
    return list.length > 0;
  }
  const tilesHour = new Map();
  // 32c: street-level photos (Mapillary) — the token stays server-side
  // (env only, never logged, never echoed, never sent to the browser).
  // One handler per relay: it holds its photo cache and rate buckets.
  const streetHandler = createStreetHandler({
    getToken: () => (env && env.MAPILLARY_TOKEN) || null,
    fetchImpl,
    now,
  });
  // Voice transcribe: its own buckets (10 per 10 min, 40 per day per
  // client, 300 per day global), one handler per relay like consult.
  const transcribeHandler = createTranscribeHandler({ env, fetchImpl });
  const voice10 = new Map();
  const voiceDay = new Map();
  const voiceGlobal = [];

  // Raw (binary-safe) body read for the WAV upload: readBody() above
  // decodes text, which would corrupt audio bytes.
  function readRawBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > VOICE_MAX_BYTES) {
          reject(new Error("body too large"));
          if (typeof req.destroy === "function") req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function corsHeaders(res, origin) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }

  function sendJson(res, code, obj, origin) {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    corsHeaders(res, origin);
    res.end(JSON.stringify(obj));
  }

  function sendOriginError(res) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "origin" }));
  }

  function sendLimited(res, waitSec, origin) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Retry-After", String(waitSec));
    corsHeaders(res, origin);
    res.end(JSON.stringify({ ok: false, error: "rate_limited", retryAfterSec: waitSec }));
  }

  return async (req, res) => {
    const t = now();
    const origin = reqHeader(req, "origin");
    if (origin && !origins.includes(origin)) {
      sendOriginError(res);
      return;
    }
    const cors = origin || null;
    if ((req.method || "GET") === "OPTIONS") {
      res.statusCode = 204;
      if (cors) res.setHeader("Access-Control-Allow-Origin", cors);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", `content-type, ${BYOK_HEADER}, ${SESSION_HEADER}, ${JUDGE_HEADER}`);
      res.setHeader("Vary", "Origin");
      res.end();
      return;
    }
    const client = clientKey(req);
    const path = relayPath(req);

    if (isTilePath(path)) {
      if ((req.method || "GET") !== "GET") {
        sendJson(res, 405, { ok: false, error: "method" }, cors);
        return;
      }
      if (!origin) {
        // Tile <img> sends no Origin; allow it when the Referer is one
        // of ours (cross-origin <img> sends a Referer) or missing.
        const ref = String(reqHeader(req, "referer") || reqHeader(req, "referrer") || "");
        if (ref && !origins.some((o) => ref.startsWith(o))) {
          sendOriginError(res);
          return;
        }
      }
      const wait = checkBucket(tilesHour, client, t, 3600000, 4000);
      if (wait > 0) {
        sendLimited(res, wait, cors);
        return;
      }
      corsHeaders(res, cors);
      return serveTile({ path, env, fetchImpl, res });
    }

    // 32c: street photo near a home. GET only; the handler answers
    // 400 on bad lon/lat, { photo: null } when the token is missing or
    // Mapillary has nothing usable. Coordinates are the home's only —
    // never the viewer's — and nothing is stored or logged.
    if (path === "/api/street") {
      if ((req.method || "GET") !== "GET") {
        sendJson(res, 405, { ok: false, error: "method" }, cors);
        return;
      }
      corsHeaders(res, cors);
      return streetHandler(req, res);
    }

    if (path === "/api/model/status") {
      if ((req.method || "GET") !== "GET") {
        sendJson(res, 404, { ok: false, error: "not_found" }, cors);
        return;
      }
      // Booleans only — never key text.
      return sendJson(res, 200, {
        ok: true,
        meta: { hasServerKey: Boolean(metaApiKey(env)) },
        voice: { hasServerKey: Boolean(metaApiKey(env)) },
        baseten: { hasServerKey: Boolean(env.BASETEN_API_KEY) },
        recorded: { hasServerKey: true },
        relay: true,
      }, cors);
    }

    if (path === "/api/voice/transcribe") {
      if ((req.method || "GET") !== "POST") {
        sendJson(res, 405, { ok: false, error: "method" }, cors);
        return;
      }
      // 43a: a valid judge code skips the per-IP voice buckets;
      // the global voice bucket still applies.
      const judge = isJudge(req, codes);
      const over = judge
        ? checkGlobal(voiceGlobal, t, DAY_MS, 300)
        : Math.max(
          checkBucket(voice10, client, t, 600000, 10),
          checkBucket(voiceDay, client, t, DAY_MS, 40),
          checkGlobal(voiceGlobal, t, DAY_MS, 300),
        );
      if (over > 0) {
        sendLimited(res, over, cors);
        return;
      }
      // Buffer the WAV body once and hand it to the handler parked on
      // req.body so it is read exactly once.
      if (req.body === undefined || req.body === null) {
        try {
          req.body = await readRawBody(req);
        } catch {
          sendJson(res, 413, { ok: false, error: "too_large" }, cors);
          return;
        }
      } else if (typeof Buffer !== "undefined" && !Buffer.isBuffer(req.body)) {
        req.body = Buffer.from(String(req.body));
      }
      corsHeaders(res, cors);
      return transcribeHandler(req, res);
    }

    if (path === "/api/consult") {
      // 41e: server key only — one chat session per IP. BYOK
      // requests keep their current buckets, unchecked here.
      // 43a: a valid judge code skips the session rule and the
      // per-IP buckets; it counts against the judge global bucket
      // plus the public global cap instead.
      const byok = reqHeader(req, BYOK_HEADER);
      const judge = isJudge(req, codes);
      if (!byok && !judge) {
        const rawSession = reqHeader(req, SESSION_HEADER);
        const session = typeof rawSession === "string" ? rawSession.slice(0, 64) : "";
        if (await serverKeySessionBlocked(client, session)) {
          sendJson(res, 429, { ok: false, error: "server_key_used", byok: true }, cors);
          return;
        }
      }
      const over = judge
        ? Math.max(
          checkGlobal(consultJudge, t, DAY_MS, 400),
          checkGlobal(consultGlobal, t, DAY_MS, 600),
        )
        : Math.max(
          checkBucket(consult10, client, t, 600000, 20),
          checkBucket(consultDay, client, t, DAY_MS, 100 * sessionsPerIp(env)),
          checkGlobal(consultGlobal, t, DAY_MS, 600),
        );
      if (over > 0) {
        sendLimited(res, over, cors);
        return;
      }
      // Peek at the provider first: the baseten day bucket below
      // applies to every open-weights call (BYOK or server key).
      // Buffer the body once and hand it to the handler parked on
      // req.body so it is read exactly once.
      let provider;
      try {
        const raw = await readBody(req);
        try {
          provider = JSON.parse(raw).provider;
        } catch {
          provider = undefined;
        }
        req.body = raw;
      } catch {
        provider = undefined;
      }
      if (provider === "baseten"
        && checkGlobal(consultGlobalBaseten, t, DAY_MS, 150) > 0) {
        sendJson(res, 429, { ok: false, error: "open_limit" }, cors);
        return;
      }
      // 41f: without the BYOK header, "meta" (or missing) stays on the
      // server key as before; "baseten" needs BASETEN_API_KEY on the
      // server. Anything else is rejected.
      if (!byok) {
        if (provider === undefined || provider === "meta") {
          /* server key path, allowed */
        } else if (provider === "baseten") {
          if (!env.BASETEN_API_KEY) {
            sendJson(res, 400, { ok: false, error: "provider" }, cors);
            return;
          }
        } else {
          sendJson(res, 400, { ok: false, error: "provider" }, cors);
          return;
        }
      }
      corsHeaders(res, cors);
      return consultHandler(req, res);
    }

    sendJson(res, 404, { ok: false, error: "not_found" }, cors);
  };
}
