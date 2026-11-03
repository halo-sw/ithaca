// Diary image: POST /api/image/diary draws a small flat editorial
// illustration of one checked diary line (Muse Image). Decoration only,
// always labelled; never a photo of the real place. The key stays
// server-side (env). Nothing is stored.
//
// The server builds the prompt itself from a fixed scene list. The
// browser sends only { kind, minute, region }; no customer text
// reaches the model.
//
// Upstream (measured 2026-11-03):
//   POST https://api.meta.ai/v1/images/generations
//   Authorization: Bearer <key>
//   {"model":"muse-image-1.0","prompt":"<text>","n":1,"size":"1024x1024"}
//   → 200 {"created":…,"data":[{"b64_json":"<base64>"}],
//          "output_format":"webp","background":"opaque","usage":{…}}

import { META_API_BASE, metaApiKey } from "../judge/providers.js";

export const IMAGE_MODEL = "muse-image-1.0";
export const IMAGE_URL = META_API_BASE + "/images/generations";
export const IMAGE_PROMPT_PREFIX =
  "Flat editorial illustration, soft muted colours, no text, no logos, no real addresses, no identifiable people: ";

export const SCENE_KINDS = ["commute", "errand", "park", "ride", "plan"];
export const SCENES = {
  commute: { kr: "a figure seen from behind walking to a subway entrance on a Korean apartment-district street",
             us: "a figure seen from behind walking to a commuter-train platform in a quiet Bay Area suburb" },
  errand:  { kr: "a figure seen from behind carrying a grocery bag out of a small neighbourhood mart in a Korean city",
             us: "a figure seen from behind carrying a grocery bag out of a neighbourhood market in a Bay Area suburb" },
  park:    { kr: "a figure seen from behind walking on a path in a small park between Korean apartment blocks",
             us: "a figure seen from behind walking on a path in a leafy Bay Area neighbourhood park" },
  ride:    { kr: "the inside of a busy subway car in a Korean city, passengers seen from behind",
             us: "the inside of a commuter-train carriage on the San Francisco Peninsula, passengers seen from behind" },
  plan:    { kr: "a quiet weekend morning inside a small Korean apartment, sunlight on the floor",
             us: "a quiet weekend morning inside a small Bay Area apartment, sunlight on the floor" },
};

export function lightFor(minute) {
  const m = ((Number(minute) % 1440) + 1440) % 1440;
  if (m < 360) return "before dawn, deep blue sky";
  if (m < 660) return "soft morning light";
  if (m < 1020) return "bright afternoon light";
  if (m < 1200) return "early evening, sunset glow";
  return "night, warm street lights";
}

export function scenePrompt({ kind, minute, region }) {
  return IMAGE_PROMPT_PREFIX + SCENES[kind][region] + ", " + lightFor(minute);
}

function readJsonBody(req, limit) {
  const parked = req && req.body !== undefined && req.body !== null ? req.body : undefined;
  if (parked !== undefined) {
    if (typeof parked === "string") return Promise.resolve(parked.slice(0, limit + 1));
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(parked)) {
      return Promise.resolve(parked.toString("utf8").slice(0, limit + 1));
    }
    if (parked instanceof Uint8Array) {
      return Promise.resolve(Buffer.from(parked).toString("utf8").slice(0, limit + 1));
    }
    try {
      return Promise.resolve(JSON.stringify(parked).slice(0, limit + 1));
    } catch {
      return Promise.resolve("");
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(String(c));
      size += buf.length;
      chunks.push(buf);
      if (size > limit) {
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createDiaryImageHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 45000 } = {}) {
  return async (req, res) => {
    const send = (code, obj) => {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(obj));
    };
    if ((req.method || "GET") !== "POST") {
      send(405, { ok: false, error: "method" });
      return;
    }
    let raw;
    try {
      raw = await readJsonBody(req, 1024);
    } catch {
      send(400, { ok: false, error: "bad_request" });
      return;
    }
    if (raw.length > 1024) {
      send(400, { ok: false, error: "bad_request" });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      send(400, { ok: false, error: "bad_request" });
      return;
    }
    const body = parsed && typeof parsed === "object" ? parsed : {};
    const { kind, minute, region } = body;
    if (
      !SCENE_KINDS.includes(kind) ||
      typeof minute !== "number" ||
      !Number.isFinite(minute) ||
      minute < 0 ||
      minute >= 1440 ||
      (region !== "kr" && region !== "us")
    ) {
      send(400, { ok: false, error: "bad_scene" });
      return;
    }
    const key = metaApiKey(env || {});
    if (!key) {
      send(503, { ok: false, error: "no_key" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp = null;
    try {
      resp = await fetchImpl(IMAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: scenePrompt({ kind, minute, region }),
          n: 1,
          size: "1024x1024",
        }),
        signal: controller.signal,
      });
    } catch {
      resp = null;
    } finally {
      clearTimeout(timer);
    }
    const status = resp && typeof resp.status === "number" ? resp.status : 0;
    if (!resp || status !== 200) {
      // The upstream status number only — never upstream text, never the key.
      send(502, { ok: false, error: "upstream", status: status || 500 });
      return;
    }
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (typeof b64 !== "string" || b64.length === 0) {
      send(502, { ok: false, error: "upstream", status: 200 });
      return;
    }
    const fmt = (data && data.output_format) || "webp";
    send(200, { ok: true, model: IMAGE_MODEL, image: "data:image/" + fmt + ";base64," + b64 });
  };
}
