import { META_API_BASE, metaApiKey } from "../judge/providers.js";

const SAM_MODEL = "sam-3.1";
const SAM_URL = META_API_BASE + "/responses";
const PHOTO_MAX_BYTES = 4_000_000;
const WINDOW_MIN_SCORE = 0.5;
export const WINDOW_MIN_FRAC = 0.005;

function parseSamBoxes(text) {
  const out = [];
  if (typeof text !== "string" || !text) return out;
  const re = /(\d+)<\|box;([^|]*)\|>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = Number(m[1]);
    const fields = m[2].split(";");
    const kv = {};
    for (const f of fields) {
      const eq = f.indexOf("=");
      if (eq < 0) continue;
      kv[f.slice(0, eq).trim()] = f.slice(eq + 1).trim();
    }
    const keys = ["x1", "y1", "x2", "y2", "w", "h"];
    const vals = {};
    let ok = true;
    for (const k of keys) {
      const v = kv[k];
      if (v === undefined || v === "") { ok = false; break; }
      if (!/^-?\d+$/.test(v)) { ok = false; break; }
      vals[k] = Number(v);
    }
    if (!ok) continue;
    if (!(vals.w > 0) || !(vals.h > 0)) continue;
    let score = null;
    if (kv.c !== undefined && kv.c !== "") {
      const n = Number(kv.c);
      score = Number.isFinite(n) ? n : null;
    }
    out.push({
      id,
      bbox: [vals.x1, vals.y1, vals.x2 + 1, vals.y2 + 1],
      frameW: vals.w,
      frameH: vals.h,
      score,
    });
  }
  return out;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function windowsSummary(boxes, minScore = WINDOW_MIN_SCORE) {
  if (!boxes || boxes.length === 0) {
    return { windows: [], frame: { w: 0, h: 0 }, unionFrac: 0 };
  }
  const frame = { w: boxes[0].frameW, h: boxes[0].frameH };
  const area = frame.w * frame.h;
  const scored = boxes.filter((b) => b.score === null || b.score >= minScore);
  const sized = scored.filter((b) => {
    if (!(area > 0)) return true;
    const w = b.bbox[2] - b.bbox[0];
    const h = b.bbox[3] - b.bbox[1];
    return w > 0 && h > 0 && (w * h) / area >= WINDOW_MIN_FRAC;
  });
  const boxArea = (b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
  const interArea = (a, b) => {
    const x0 = Math.max(a.bbox[0], b.bbox[0]);
    const x1 = Math.min(a.bbox[2], b.bbox[2]);
    const y0 = Math.max(a.bbox[1], b.bbox[1]);
    const y1 = Math.min(a.bbox[3], b.bbox[3]);
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  };
  const nested = [];
  for (const b of [...sized].sort((p, q) => boxArea(q) - boxArea(p))) {
    const own = boxArea(b);
    if (!(own > 0)) continue;
    if (nested.some((k) => interArea(b, k) / own >= 0.9)) continue;
    nested.push(b);
  }
  const kept = sized.filter((b) => nested.includes(b));
  const windows = kept.map((b) => {
    const w = b.bbox[2] - b.bbox[0];
    const h = b.bbox[3] - b.bbox[1];
    return {
      bbox: b.bbox,
      boxFrac: area > 0 ? round3((w * h) / area) : 0,
      score: b.score,
    };
  });
  let unionFrac = 0;
  if (kept.length > 0 && area > 0) {
    const xs = [...new Set(kept.flatMap((b) => [b.bbox[0], b.bbox[2]]))].sort((a, b) => a - b);
    const ys = [...new Set(kept.flatMap((b) => [b.bbox[1], b.bbox[3]]))].sort((a, b) => a - b);
    let union = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i];
        const x1 = xs[i + 1];
        const y0 = ys[j];
        const y1 = ys[j + 1];
        for (const b of kept) {
          if (b.bbox[0] <= x0 && b.bbox[2] >= x1 && b.bbox[1] <= y0 && b.bbox[3] >= y1) {
            union += (x1 - x0) * (y1 - y0);
            break;
          }
        }
      }
    }
    unionFrac = round3(union / area);
  }
  return { windows, frame, unionFrac };
}

function imageMime(bytes) {
  if (!bytes || bytes.length < 3) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

function buildSamBody(bytes, mime) {
  const b64 = Buffer.from(bytes).toString("base64");
  return {
    model: SAM_MODEL,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "window" },
          { type: "input_image", image_url: `data:${mime};base64,${b64}` },
        ],
      },
    ],
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
  };
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function readRawBody(req, max = PHOTO_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      const parked = req.body;
      const buf = Buffer.isBuffer(parked)
        ? parked
        : parked instanceof Uint8Array
          ? Buffer.from(parked)
          : Buffer.from(String(parked), "utf8");
      if (buf.length > max) {
        reject(new Error("too_large"));
        return;
      }
      resolve(buf);
      return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (c) => {
      if (failed) return;
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > max) {
        failed = true;
        const err = new Error("too_large");
        err.code = "too_large";
        reject(err);
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (!failed) resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function createWindowsHandler({ env = process.env, fetchImpl = fetch, timeoutMs = 25000 } = {}) {
  return async (req, res) => {
    if ((req.method || "GET") !== "POST") {
      sendJson(res, 405, { ok: false, error: "method" });
      return;
    }
    let bytes;
    try {
      bytes = await readRawBody(req, PHOTO_MAX_BYTES);
    } catch (e) {
      sendJson(res, 413, { ok: false, error: "too_large" });
      return;
    }
    if (!bytes || bytes.length > PHOTO_MAX_BYTES) {
      sendJson(res, 413, { ok: false, error: "too_large" });
      return;
    }
    const mime = imageMime(bytes);
    if (!mime) {
      sendJson(res, 400, { ok: false, error: "bad_image" });
      return;
    }
    const key = metaApiKey(env || {});
    if (!key) {
      sendJson(res, 503, { ok: false, error: "no_key" });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let upstream = null;
    try {
      upstream = await fetchImpl(SAM_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildSamBody(bytes, mime)),
        signal: ctrl.signal,
      });
    } catch (e) {
      upstream = null;
    } finally {
      clearTimeout(t);
    }
    const status = upstream && typeof upstream.status === "number" ? upstream.status : 0;
    if (!upstream || status !== 200) {
      sendJson(res, 502, { ok: false, error: "upstream", status: status || 500 });
      return;
    }
    let data;
    try {
      data = await upstream.json();
    } catch (e) {
      sendJson(res, 502, { ok: false, error: "upstream", status: 200 });
      return;
    }
    let text = "";
    const output = (data && data.output) || [];
    for (const item of output) {
      const content = (item && item.content) || [];
      for (const c of content) {
        if (c && c.type === "output_text" && typeof c.text === "string") text += c.text;
      }
    }
    const boxes = parseSamBoxes(text);
    const { windows, frame, unionFrac } = windowsSummary(boxes);
    sendJson(res, 200, { ok: true, model: SAM_MODEL, frame, windows, unionFrac, count: windows.length });
  };
}

export {
  SAM_MODEL,
  SAM_URL,
  PHOTO_MAX_BYTES,
  WINDOW_MIN_SCORE,
  parseSamBoxes,
  windowsSummary,
  buildSamBody,
  imageMime,
  createWindowsHandler,
};
