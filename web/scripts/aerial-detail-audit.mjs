// 46d browser QA runner (QA only, not a product dependency).
// Usage: node web/scripts/aerial-detail-audit.mjs <outputDir> <case...>
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const PW_PATH = process.env.ITHACA_PLAYWRIGHT_PATH ||
  "/Users/halo.axz-pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const BASE_URL = process.env.ITHACA_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:48953";
const TILE_PROXY = process.env.ITHACA_TILE_PROXY || process.env.TILE_PROXY || "http://127.0.0.1:48741";
const QA_RECORD = process.env.ITHACA_QA_RECORD ||
  "/Users/halo.axz-pc/Documents/Codex/2026-11-02/dl/work/region-ground/menlo-qa-record.json";

const MARKER = "return {\n    origin, cx, cy, span, renderer, renderCtl, rig, scene, camera, controls,";
const INJECT = "window.__aerialAudit = {renderer,renderCtl,scene,camera,controls,aerialDetail,store};\n" + MARKER;

const CASES = {
  "pangyo-wide": { url: "/?area=pangyo&time=12:00&lang=en&q=low", kind: "tour" },
  "pangyo-close": { url: "/?area=pangyo&time=12:00&lang=en&q=low", kind: "tour-close" },
  "menlo-wide": { url: "/?area=us-menlo&time=12:00&lang=en&q=low", kind: "tour" },
  "menlo-home": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20", kind: "sim-fixture" },
  "menlo-dest": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=B&t=08:40", kind: "sim-fixture" },
  "menlo-failure": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20", kind: "sim-fixture", failNaip: true },
  "menlo-medium": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20", kind: "sim-fixture", q: "medium", dpr: 2 },
  "pangyo-medium": { url: "/?area=pangyo&time=12:00&lang=en&q=medium", kind: "tour", dpr: 2 },
  "menlo-moving": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20", kind: "sim-fixture", motion: true },
  "menlo-night": { url: "sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=00:00", kind: "sim-fixture" },
  "pangyo-dest": { url: "/?mode=sim&scenario=demo-two-homes&home=A&day=1&t=08:32&follow=1&lang=en&q=low", kind: "sim" },
};

function caseDef(name) {
  if (CASES[name]) return { name, ...CASES[name] };
  throw new Error(`unknown case ${name}`);
}

function withQ(url, q) {
  if (url.includes("custom=qa-menlo-surfaces")) {
    const qq = q || "low";
    return `/?mode=${url}&lang=en&q=${qq}`;
  }
  return url;
}

async function main() {
  const [outDir, ...names] = process.argv.slice(2);
  if (!outDir || !names.length) {
    console.error("usage: node web/scripts/aerial-detail-audit.mjs <outputDir> <case...>");
    process.exit(2);
  }
  await fs.mkdir(outDir, { recursive: true });
  const require = createRequire(import.meta.url);
  const { chromium } = require(PW_PATH);
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1440,900"] });
  let unexpected = 0;
  try {
    for (const n of names) {
      try {
        const s = await runCase(browser, caseDef(n), outDir);
        console.log(JSON.stringify(s));
        if (s.unexpected) unexpected += 1;
      } catch (err) {
        console.log(JSON.stringify({ case: n, error: String((err && err.message) || err) }));
        unexpected += 1;
      }
    }
  } finally {
    await browser.close();
  }
  if (unexpected) process.exit(1);
}

async function runCase(browser, def, outDir) {
  const errors = [];
  const logs = [];
  const requests = [];
  const dpr = def.dpr || 1;
  const ctxOptions = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr };
  if (def.motion) ctxOptions.recordVideo = { dir: outDir, size: { width: 1440, height: 900 } };
  const ctx = await browser.newContext(ctxOptions);
  const page = await ctx.newPage();
  let instrumentBefore = false;
  let instrumentAfter = false;
  try {
    page.on("console", (m) => {
      const t = m.type();
      const text = m.text();
      if (t === "error" || t === "warning" || text.includes("[render]") || text.includes("[aerial]") || text.includes("[aerial-detail]")) {
        logs.push({ type: t, text: text.slice(0, 500) });
        if (t === "error") errors.push({ kind: "console", text: text.slice(0, 500) });
      }
    });
    page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: String((e && e.message) || e).slice(0, 500) }));
    page.on("response", (r) => {
      const st = r.status();
      if (st >= 400) {
        const u = r.url();
        const pub = u.replace(/[?&](key|apiKey|apikey|token)=[^&]*/gi, "");
        requests.push({ url: pub.slice(0, 300), status: st });
      }
    });
    // Instrument Vite-transformed /src/main.js once (no persistent source change).
    await page.route("**/src/main.js*", async (route) => {
      const resp = await route.fetch();
      let body = await resp.text();
      const before = body.includes(MARKER);
      if (before) instrumentBefore = true;
      if (before && !body.includes("__aerialAudit")) body = body.replace(MARKER, INJECT);
      const after = body.includes(MARKER);
      if (after) instrumentAfter = true;
      logs.push({ type: "info", text: `instrument main.js matched before=${before} after=${after}` });
      await route.fulfill({ response: resp, body });
    });
    // Forward aerial API 48953 -> 48741 without reading keys.
    await page.route("**/api/aerial/**", async (route) => {
      const url = route.request().url().replace(BASE_URL, TILE_PROXY).replace(/:48953/, ":48741");
      try {
        const resp = await route.fetch({ url });
        await route.fulfill({ response: resp });
      } catch (e) {
        errors.push({ kind: "aerial-proxy", text: String((e && e.message) || e).slice(0, 300) });
        try { await route.abort(); } catch { /* noop */ }
      }
    });
    if (def.failNaip) {
      await page.route("**/USGSNAIPPlus/ImageServer/exportImage*", async (route) => {
        await route.fulfill({ status: 503, body: "injected NAIP failure" });
      });
    }

    const isSimFixture = def.kind === "sim-fixture";
    if (isSimFixture) {
      const raw = await fs.readFile(QA_RECORD, "utf8");
      const record = JSON.parse(raw);
      await page.goto(`${BASE_URL}/?lang=en`, { waitUntil: "domcontentloaded" });
      await page.evaluate(async (rec) => {
        const m = await import("/src/chat/idb.js");
        await m.saveCustomRun(rec);
      }, record);
    }
    const target = def.kind === "sim-fixture" ? withQ(def.url, def.q) : def.url.includes("?") ? def.url : `/${def.url}`;
    // pangyo-close shares pangyo-wide URL; menlo-medium overrides q=medium.
    const selectedPath = def.name === "menlo-medium"
      ? "/?mode=sim&custom=qa-menlo-surfaces&day=1&follow=1&home=A&t=08:20&lang=en&q=medium"
      : target;
    const finalUrl = new URL(selectedPath, BASE_URL).toString();
    await page.goto(finalUrl, { waitUntil: "domcontentloaded" });

    // Pause autoplay via actual store actions after ready; avoid random drift.
    await page.waitForFunction(() => !!(window.__aerialAudit && window.__aerialAudit.store), null, { timeout: 90000 });
    const pauseKind = (def.kind === "tour" || def.kind === "tour-close") ? "tour" : "sim";
    const pauseAction = pauseKind === "tour" ? "toggleTourPlay" : "toggleSimPlay";
    await page.waitForFunction((action) => {
      try {
        const a = window.__aerialAudit;
        if (!a || !a.store || typeof a.store.getState !== "function" || typeof a.store.hasAction !== "function") return false;
        const st = a.store.getState() || {};
        return st.ready === true && a.store.hasAction(action);
      } catch { return false; }
    }, pauseAction, { timeout: 90000 });
    await page.evaluate((action) => {
      const a = window.__aerialAudit;
      const st = a.store.getState() || {};
      if (action === "toggleTourPlay") {
        if (st.tourPlaying && a.store.hasAction("toggleTourPlay")) a.store.act("toggleTourPlay");
      } else if (st.playing && a.store.hasAction("toggleSimPlay")) {
        a.store.act("toggleSimPlay");
      }
    }, pauseAction);
    if (def.kind === "tour-close") {
      await page.evaluate(() => {
        const a = window.__aerialAudit;
        const t = a.controls?.target;
        const p = a.camera?.position;
        if (t && p && typeof p.sub === "function") {
          p.sub(t).multiplyScalar(0.25).add(t);
          a.controls.update?.();
        }
      });
    }

    // Wait base aerial true (90s), then detail settle. Base preview success
    // may precede the final base, so allow at least 25s for all cases.
    let baseOk = false;
    try {
      await page.waitForFunction(() => {
        const a = window.__aerialAudit;
        return !!(a && a.store && typeof a.store.getState === "function" && a.store.getState().aerial === true);
      }, null, { timeout: 90000 });
      baseOk = true;
    } catch {
      errors.push({ kind: "timeout", text: "base aerial not loaded in 90s" });
    }
    const cap = def.failNaip ? 25000 : 80000;
    const t0 = Date.now();
    let settled = false;
    let finalPending = null;
    let lastStats = null;
    for (;;) {
      const s = await page.evaluate(() => {
        try { return window.__aerialAudit?.aerialDetail?.stats?.() || null; } catch { return null; }
      });
      if (s) lastStats = s;
      const elapsed = Date.now() - t0;
      const pending = !!(s && s.pending === true);
      if (s) finalPending = pending;
      if (elapsed >= 25000 && !pending) { settled = true; break; }
      if (elapsed >= cap) break;
      await page.waitForTimeout(1000).catch(() => {});
    }

    // Moving-camera QA: playback only of the existing fixture (no run/engine/camera change).
    let motion = null;
    if (def.motion) {
      const snapMotion = () => page.evaluate(() => {
        const a = window.__aerialAudit || {};
        let stats = null;
        try { stats = typeof a.aerialDetail?.stats === "function" ? a.aerialDetail.stats() : null; } catch { stats = null; }
        const st = (() => { try { return typeof a.store?.getState === "function" ? (a.store.getState() || {}) : {}; } catch { return {}; } })();
        return {
          clock: st.clock ?? null,
          playing: st.playing ?? null,
          stats,
          textures: a.renderer?.info?.memory?.textures ?? null,
          cam: { pos: a.camera?.position ? [a.camera.position.x, a.camera.position.y, a.camera.position.z] : null,
            target: a.controls?.target ? [a.controls.target.x, a.controls.target.y, a.controls.target.z] : null },
        };
      });
      motion = { before: await snapMotion() };
      await fs.writeFile(path.join(outDir, `${def.name}-start.png`), await page.screenshot({ type: "png" }));
      await page.evaluate(() => {
        const a = window.__aerialAudit;
        if (!a || !a.store) return;
        try {
          if (typeof a.store.hasAction !== "function" || a.store.hasAction("setSpeed")) a.store.act("setSpeed", 0.1);
        } catch { /* noop */ }
        try {
          const st = typeof a.store.getState === "function" ? (a.store.getState() || {}) : {};
          if (!st.playing && a.store.hasAction("toggleSimPlay")) a.store.act("toggleSimPlay");
        } catch { /* noop */ }
      });
      await page.waitForTimeout(8000).catch(() => {});
      await page.evaluate(() => {
        try {
          const a = window.__aerialAudit;
          const st = a?.store?.getState?.() || {};
          if (st.playing && a.store.hasAction("toggleSimPlay")) a.store.act("toggleSimPlay");
        } catch { /* noop */ }
      });
      motion.after = await snapMotion();
    }

    // ~30 rAF intervals once after settle (diagnostic, not a benchmark claim).
    const raf = await page.evaluate(() => new Promise((res) => {
      const ds = []; let last = 0; let n = 0;
      const tick = (t) => {
        if (last) ds.push(t - last);
        last = t; n += 1;
        if (n < 30) requestAnimationFrame(tick); else res(ds);
      };
      requestAnimationFrame(tick);
    })).catch(() => []);

    let data = null;
    if (baseOk) {
      data = await page.evaluate(() => {
        const a = window.__aerialAudit || {};
        const stats = (() => { try { return typeof a.aerialDetail?.stats === "function" ? a.aerialDetail.stats() : null; } catch { return null; } })();
        const meshes = [];
        try {
          a.scene?.traverse?.((o) => {
            const m = o?.material;
            const maps = Array.isArray(m?.map) ? m.map : (m?.map ? [m.map] : []);
            const umap = m?.uniforms?.uAerialMap?.value || m?.uniforms?.map?.value;
            if (umap && umap.image) {
              meshes.push({ map: [umap.image.width || 0, umap.image.height || 0],
                mpp: umap.userData?.aerialMpp ?? null,
                detail: !!(m?.uniforms?.uAerialMap),
                parent: o?.parent?.type || o?.parent?.name || null });
            }
            for (const t of maps) {
              if (t?.image) meshes.push({ map: [t.image.width || 0, t.image.height || 0],
                mpp: t.userData?.aerialMpp ?? null, detail: false,
                parent: o?.parent?.type || o?.parent?.name || null });
            }
          });
        } catch { /* traverse best-effort */ }
        const st = typeof a.store?.getState === "function" ? (a.store.getState() || {}) : {};
        let credit = null;
        try {
          const els = [...document.querySelectorAll("[data-credit], .credit, .ui-simcredit, .attribution, footer")];
          credit = els.map((e) => (e.textContent || "").trim().slice(0, 200)).find(Boolean) || null;
        } catch { /* noop */ }
        return {
          stats,
          area: st.area ?? null, aerial: st.aerial ?? null,
          playing: st.playing ?? null, tourPlaying: st.tourPlaying ?? null, clock: st.clock ?? null,
          second: st.aerialSecondByArea ?? st.aerialSecond ?? null,
          cam: { pos: a.camera?.position ? [a.camera.position.x, a.camera.position.y, a.camera.position.z] : null,
            target: a.controls?.target ? [a.controls.target.x, a.controls.target.y, a.controls.target.z] : null },
          quality: a.renderCtl?.quality ?? null,
          pixelRatio: a.renderer?.getPixelRatio?.() ?? null,
          calls: a.renderer?.info?.render?.calls ?? null,
          triangles: a.renderer?.info?.render?.triangles ?? null,
          textures: a.renderer?.info?.memory?.textures ?? null,
          canvas: a.renderer?.domElement ? [a.renderer.domElement.width, a.renderer.domElement.height] : null,
          meshes: meshes.slice(0, 40), credit,
        };
      });
    }
    let videoPath = null;
    if (def.motion) {
      try {
        const v = page.video();
        if (v) videoPath = await v.path().catch(() => null);
      } catch { /* noop */ }
    }
    const out = { case: def.name, url: finalUrl, baseOk, settled, finalPending, finalStats: lastStats, errors, logs: logs.slice(0, 60), requests, data, raf, motion, videoPath };
    await fs.writeFile(path.join(outDir, `${def.name}.png`), await page.screenshot({ type: "png" }));
    await fs.writeFile(path.join(outDir, `${def.name}.json`), JSON.stringify(out, null, 2));
    if (def.motion) console.log(JSON.stringify({ case: def.name, video: videoPath }));
    const bad = requests.filter((r) => !(def.failNaip && r.status === 503)).length;
    const unexpectedErrors = errors.filter((e) => !(def.failNaip && /503/.test(e.text || "")));
    return { case: def.name, errors: errors.length, badRequests: bad,
      detail: data?.stats ?? null, base: data?.meshes?.map((m) => m.map) ?? null,
      quality: data?.quality ?? null, pending: finalPending, settled,
      motion: motion ? { before: motion.before ?? null, after: motion.after ?? null } : null, video: videoPath,
      unexpected: (unexpectedErrors.length > 0 || bad > 0 || (!baseOk && !def.failNaip) || (!def.failNaip && Number(data?.stats?.errors) > 0)) };
  } catch (err) {
    let diag = null;
    try {
      diag = await page.evaluate((flags) => {
        let ready = null;
        try { ready = window.__aerialAudit?.store?.getState?.()?.ready ?? null; } catch { ready = null; }
        let bodyText = null;
        try { bodyText = (document.body?.innerText || "").slice(0, 1000); } catch { bodyText = null; }
        return { auditType: typeof window.__aerialAudit, ready, bodyText, instrumentBefore: flags?.instrumentBefore ?? null, instrumentAfter: flags?.instrumentAfter ?? null };
      }, { instrumentBefore, instrumentAfter });
    } catch {
      diag = { auditType: null, ready: null, bodyText: null, instrumentBefore, instrumentAfter };
    }
    let pageUrl = null;
    try { pageUrl = page.url(); } catch { pageUrl = null; }
    try { await fs.writeFile(path.join(outDir, `${def.name}-error.png`), await page.screenshot({ type: "png" })); } catch { /* noop */ }
    try {
      await fs.writeFile(path.join(outDir, `${def.name}-error.json`),
        JSON.stringify({ case: def.name, error: String((err && err.message) || err), stack: (err && err.stack) || null, errors, logs: logs.slice(0, 60), requests, pageUrl, diag }, null, 2));
    } catch { /* noop */ }
    throw err;
  } finally {
    try { await page.close(); } catch { /* noop */ }
    try { await ctx.close(); } catch { /* noop */ }
  }
}

await main();
