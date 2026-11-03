import { LIVE_API, apiUrl } from "../paths.js";

export const SAM_PHOTO_ENABLED =
  typeof import.meta !== "undefined" &&
  !!import.meta.env &&
  import.meta.env.VITE_SAM_PHOTO === "1";

export function windowsLine(result) {
  if (!result || typeof result !== "object") return "사진을 읽지 못했어요";
  if (result.count > 0) {
    const pct = Math.round((result.unionFrac || 0) * 100);
    return `이 사진에서 창 ${result.count}개 · 사진의 ${pct}%`;
  }
  if (result.count === 0) return "이 사진에서 창을 찾지 못했어요.";
  return "사진을 읽지 못했어요";
}

export async function downscaleToJpeg(file, maxSide = 1600, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > maxSide ? maxSide / longSide : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (typeof bitmap.close === "function") bitmap.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode"))),
      "image/jpeg",
      quality,
    );
  });
  return blob;
}

export async function postWindowsWith(fetchImpl, url, blob) {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
    try {
      return await res.json();
    } catch {
      return { ok: false, error: "upstream" };
    }
  } catch {
    return { ok: false, error: "network" };
  }
}

export function postWindows(blob) {
  if (!LIVE_API) return Promise.resolve({ ok: false, error: "offline" });
  return postWindowsWith(fetch, apiUrl("/api/vision/windows"), blob);
}
