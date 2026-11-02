// Stage 41k: session store shared across relay instances (Vercel Runtime Cache)
// backed by an async cache when available, in-memory Map fallback otherwise.
export function createSessionStore({ cache, now } = {}) {
  const TTL_SEC = 86400;
  const MAX_ENTRIES = 5000;
  const clock = typeof now === "function" ? now : () => Date.now();
  const mem = new Map(); // client -> { session, expires }

  function memGet(client) {
    const rec = mem.get(client);
    if (!rec) return null;
    if (clock() > rec.expires) {
      mem.delete(client);
      return null;
    }
    return rec.session;
  }

  function memSet(client, session, ttlSec = TTL_SEC) {
    if (!mem.has(client) && mem.size >= MAX_ENTRIES) {
      const oldest = mem.keys().next().value;
      mem.delete(oldest);
    }
    mem.set(client, { session, expires: clock() + ttlSec * 1000 });
  }

  if (!cache || typeof cache.get !== "function" || typeof cache.set !== "function") {
    return {
      async get(client) {
        return memGet(client);
      },
      async set(client, session, ttlSec = TTL_SEC) {
        memSet(client, session, ttlSec);
      },
    };
  }

  const keyFor = (client) => `srv-session:${client}`;
  return {
    async get(client) {
      const hit = await cache.get(keyFor(client));
      if (hit && typeof hit === "object" && typeof hit.session === "string") return hit.session;
      if (typeof hit === "string" && hit) return hit;
      return memGet(client) ?? null;
    },
    async set(client, session, ttlSec = TTL_SEC) {
      memSet(client, session, ttlSec);
      await cache.set(keyFor(client), { session, t: clock() }, { ttl: ttlSec });
    },
  };
}
