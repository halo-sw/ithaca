import { LIVE_API, apiUrl } from "../paths.js";

export const MUSE_IMAGE_ENABLED =
  typeof import.meta !== "undefined" && !!import.meta.env && import.meta.env.VITE_MUSE_IMAGE === "1";

export const DIARY_PICTURE_CAPTION = "Muse Image 일러스트 · 실제 장소 사진이 아니에요";

export function sceneKindOf(line) {
  const id = String(line?.id || "");
  if (id.endsWith(":errand")) return "errand";
  if (id.endsWith(":park")) return "park";
  if (id.endsWith(":ride")) return "ride";
  if (id.includes("weekend_plan")) return "plan";
  if (/^t\d+$/.test(id)) return "commute";
  return null;
}

export function regionOf(compare) {
  return String(compare?.home_a?.area || "").startsWith("us-") ? "us" : "kr";
}

export async function postDiaryPictureWith(fetchImpl, url, body) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  try {
    return await res.json();
  } catch {
    return { ok: false, error: "upstream" };
  }
}

export function postDiaryPicture(body) {
  if (!LIVE_API) return Promise.resolve({ ok: false, error: "offline" });
  return postDiaryPictureWith(fetch, apiUrl("/api/image/diary"), body);
}

export function diaryPictureOff() {
  try {
    return sessionStorage.getItem("ithaca.diaryPicture.off") === "1";
  } catch {
    return false;
  }
}

export function setDiaryPictureOff() {
  try {
    sessionStorage.setItem("ithaca.diaryPicture.off", "1");
  } catch {}
}
