// Diary image: POST /api/image/diary draws a small flat editorial
// illustration of one checked diary line (Muse Image). Decoration only,
// always labelled; never a photo of the real place. The key stays
// server-side (env). Nothing is stored.
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
export const IMAGE_SENTENCE_MAX = 200;
export const IMAGE_PROMPT_PREFIX =
  "Flat editorial illustration, soft muted colours, no text, no logos, no real addresses, no identifiable people: ";

export function sceneSentence(text) {
  const tokens = String(text == null ? "" : text).split(/\s+/).filter((t) => t.length > 0);
  const kept = [];
  for (const tok of tokens) {
    if (/\d/.test(tok)) continue;
    if (tok === "Day" || tok === "day" || tok === "일째") continue;
    kept.push(tok);
  }
  let out = kept.join(" ").replace(/\s+/g, " ").trim();
  out = out.replace(/^[,.:;·\-\s]+/, "").replace(/[,.:;·\-\s]+$/, "");
  return out;
}

export function imagePrompt(text) {
  return IMAGE_PROMPT_PREFIX + sceneSentence(text);
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
      raw = await readJsonBody(req, 4096);
    } catch {
      send(400, { ok: false, error: "bad_request" });
      return;
    }
    if (raw.length > 4096) {
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
    const sentence = parsed && parsed.sentence;
    if (typeof sentence !== "string") {
      send(400, { ok: false, error: "bad_request" });
      return;
    }
    if (
      sentence.length > IMAGE_SENTENCE_MAX ||
      sentence.includes("http") ||
      sceneSentence(sentence).length < 3
    ) {
      send(400, { ok: false, error: "bad_sentence" });
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
          prompt: imagePrompt(sentence),
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
