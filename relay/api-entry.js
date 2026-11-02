import { createRelay } from "./handler.js";
import { createSessionStore } from "./session-store.js";

async function buildSessionStore() {
  try {
    const { getCache } = await import("@vercel/functions");
    return createSessionStore({ cache: getCache({ namespace: "ithaca" }) });
  } catch {
    return createSessionStore();
  }
}

const relay = createRelay({ env: process.env, sessionStore: await buildSessionStore() });

export default function handler(req, res) {
  return relay(req, res);
}
