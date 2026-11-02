// Stage 41k: session store shared across relay instances (Vercel Runtime Cache)
// backed by an async cache when available, in-memory Map fallback otherwise.
// 43a: one IP may hold several sessions (env SESSIONS_PER_IP, default 1),
// so the stored value is { sessions: [id, …] }; get() always returns an
// array (old { session } / bare-string values read back as [session]).
export function createSessionStore({ cache, now } = {}) {
  const TTL_SEC = 86400;
  const MAX_ENTRIES = 5000;
  const clock = typeof now === "function" ? now : () => Date.now();
  const mem = new Map(); // client -> { sessions, expires }

  function cleanList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((s) => typeof s === "string" && s.length > 0);
  }

  // A stored hit in any known shape becomes a session list; anything
  // else (nothing stored) is null so the caller can try the fallback.
  function toList(hit) {
    if (Array.isArray(hit)) return cleanList(hit);
    if (hit && typeof hit === "object") {
      if (Array.isArray(hit.sessions)) return cleanList(hit.sessions);
      if (typeof hit.session === "string" && hit.session) return [hit.session];
      return null;
    }
    if (typeof hit === "string" && hit) return [hit];
    return null;
  }

  function memGet(client) {
    const rec = mem.get(client);
    if (!rec) return [];
    if (clock() > rec.expires) {
      mem.delete(client);
      return [];
    }
    return cleanList(rec.sessions);
  }

  function memSet(client, sessions, ttlSec = TTL_SEC) {
    if (!mem.has(client) && mem.size >= MAX_ENTRIES) {
      const oldest = mem.keys().next().value;
      mem.delete(oldest);
    }
    mem.set(client, { sessions: cleanList(sessions), expires: clock() + ttlSec * 1000 });
  }

  if (!cache || typeof cache.get !== "function" || typeof cache.set !== "function") {
    return {
      async get(client) {
        return memGet(client);
      },
      async set(client, sessions, ttlSec = TTL_SEC) {
        memSet(client, sessions, ttlSec);
      },
    };
  }

  const keyFor = (client) => `srv-session:${client}`;
  return {
    async get(client) {
      const hit = await cache.get(keyFor(client));
      const list = toList(hit);
      if (list !== null) return list;
      return memGet(client);
    },
    async set(client, sessions, ttlSec = TTL_SEC) {
      memSet(client, sessions, ttlSec);
      await cache.set(keyFor(client), { sessions: cleanList(sessions), t: clock() }, { ttl: ttlSec });
    },
  };
}
