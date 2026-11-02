# Stage 41k — the one-session-per-IP rule holds across relay instances (brief for Muse)

Agent mode, rules in `AGENTS.md`. Sandbox: no network. No sub-agents, no git, no todo list. First edit in your first tool call. Touch only `relay/handler.js`, `relay/api-entry.js`, `relay/build.mjs`, one new small module under `relay/`, and tests.

## Why
41e keeps "first session id per IP" in an in-memory `Map` (`relay/handler.js:118-155`, `serverKeyUse`). On Vercel the relay runs on several function instances, so the map is per instance. Live check on 2026-11-02: two browser sessions 45 s apart from the same IP were both answered on the server key (each landed on a different instance); three quick curl calls on one warm instance were refused correctly (`429 server_key_used`). The owner's rule is "IP별 세션당 1회": it must hold across instances.

## Change
1. New `relay/session-store.js`: `createSessionStore({ cache })` returning `{ async get(client), async set(client, session, ttlSec) }`.
   - With `cache` (an object with async `get(key)` / `set(key, value, { ttl })`), keys are `srv-session:<client>`, value `{ session, t }`, ttl 86400 s.
   - Without it, today's in-memory Map logic (TTL, size cap) is used.
2. `relay/handler.js`: `createRelay({ env, sessionStore })` — the 41e check uses `await sessionStore.get/set` (default: the in-memory store, so `relay/server.mjs` and tests keep working unchanged). Same rules as 41e: same session → allowed; different or missing session after one was recorded → `429 server_key_used`; BYOK exempt; a failing store call (throws) is logged without the client IP and falls back to the in-memory store for that request (never blocks everyone, never lets an error crash the request).
3. `relay/api-entry.js` (Vercel only): build the store from the Vercel Runtime Cache — `const { getCache } = await import("@vercel/functions")` inside a try/catch (dynamic import so local runs and tests do not need the package), `getCache({ namespace: "ithaca" })`, and pass `createSessionStore({ cache })`. If the import fails, use the in-memory store.
4. `relay/build.mjs`: mark `@vercel/functions` as `external` in esbuild and write it into `dist/package.json` `dependencies` (`"@vercel/functions": "^3"`) so Vercel installs it at deploy.

## Tests — new `web/tests/session-store-41k.test.js` (drive the handler the way `server-key-once-41e.test.js` does)
- Two relay instances created with the **same** fake cache object (a Map behind async get/set): session "a" on instance 1 is allowed; session "b" from the same IP on instance 2 → `429 server_key_used`; session "a" on instance 2 → allowed.
- A cache whose `get` throws → request still answered (falls back), no crash.
- Without a cache, the 41e tests still pass unchanged.
- `relay/build.mjs` source pin: `@vercel/functions` is external and listed in the dist package.json dependencies.

Run: `cd web && node --test tests/session-store-41k.test.js tests/server-key-once-41e.test.js tests/relay-baseten-41f.test.js $(ls tests/*relay*.test.js | tr '\n' ' ') 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`, then the full suite once.

## Final message
Changed files one line each, suite line.
