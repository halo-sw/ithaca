// 41e: one server-key chat session per IP. The browser mints one
// random id per chat session, keeps it in sessionStorage (never in
// the URL), and sends it on every /api/consult request as
// x-ithaca-session. Node + browser safe; no DOM at import.
export const SESSION_HEADER = "x-ithaca-session";

const STORAGE_KEY = "ithaca.chatSession";

function storageOf(storage) {
  if (storage && typeof storage.getItem === "function") return storage;
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {
    /* no session storage (SSR, tests) */
  }
  return null;
}

function validSessionId(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(v)) return "";
  return v;
}

export function randomSessionId() {
  try {
    const g = typeof crypto !== "undefined" ? crypto : null;
    if (g && typeof g.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      g.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through to Math.random */
  }
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

// The tab's chat session id, minted once and reused until rotated.
export function getChatSessionId(storage) {
  const store = storageOf(storage);
  if (!store) return randomSessionId();
  try {
    const kept = validSessionId(store.getItem(STORAGE_KEY));
    if (kept) return kept;
    const fresh = randomSessionId();
    store.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return randomSessionId();
  }
}

// A new conversation gets a new id (restart, leaving a replay).
export function rotateChatSessionId(storage) {
  const fresh = randomSessionId();
  const store = storageOf(storage);
  if (store) {
    try {
      store.setItem(STORAGE_KEY, fresh);
    } catch {
      /* storage unwritable — the caller still uses the fresh id */
    }
  }
  return fresh;
}
