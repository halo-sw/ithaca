// 41f: the header model switch (Muse Spark 1.3 | Muse Spark Open).
// Pure helpers only (no React, no DOM at import): the chat owns the
// state, this module owns the rules. Unit-tested.

export const PROVIDER_STORAGE_KEY = "ithaca-provider";

export const OPEN_MODEL_HINT =
  "오픈 웨이트 모델(Muse Spark Open)로 같은 상담을 돌려 볼 수 있어요";

export const OPEN_FALLBACK_LINE_KO =
  "Muse Spark Open이 바빠서 이번 답은 Muse Spark 1.3이 했어요.";

export const OPEN_FALLBACK_LINE_EN =
  "Muse Spark Open is busy, so this answer used Muse Spark 1.3.";

export function openFallbackLine(lang) {
  return lang === "en" ? OPEN_FALLBACK_LINE_EN : OPEN_FALLBACK_LINE_KO;
}

export function isValidProvider(value) {
  return value === "meta" || value === "baseten";
}

function storageOf(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

// The customer's switch choice for the rest of the session. Never
// throws (private mode, SSR, full storage all fall back to "meta").
export function loadProviderChoice(storage) {
  try {
    const store = storageOf(storage);
    const raw = store ? store.getItem(PROVIDER_STORAGE_KEY) : null;
    return isValidProvider(raw) ? raw : "meta";
  } catch {
    return "meta";
  }
}

export function saveProviderChoice(value, storage) {
  if (!isValidProvider(value)) return false;
  try {
    const store = storageOf(storage);
    if (!store) return false;
    store.setItem(PROVIDER_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

// The open-weights item appears only when the server holds a Baseten
// key (/api/model/status → baseten.hasServerKey). Anything else keeps
// today's single label.
export function offerOpenWeights(status) {
  return !!status && !!status.baseten && status.baseten.hasServerKey === true;
}

// Header / message tag label for the model that answered.
export function providerLabel(provider) {
  if (provider === "meta" || provider === "muse-spark-1.3") return "Muse Spark 1.3";
  if (provider === "baseten" || provider === "meta-models/muse-spark-open-1026") {
    return "Muse Spark Open";
  }
  return null;
}

// Recorded replays keep the model they were recorded with: map a
// recording's meta.model to the tag's provider key (null = badge only).
export function recordedModelOf(metaModel) {
  if (metaModel === "meta" || metaModel === "muse-spark-1.3") return "meta";
  if (metaModel === "baseten" || metaModel === "meta-models/muse-spark-open-1026") {
    return "baseten";
  }
  return null;
}
