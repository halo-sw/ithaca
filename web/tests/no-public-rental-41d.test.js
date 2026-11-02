import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, "..", "src");

test("extract_profile public rental sets no tenure", async () => {
  const mod = await import("../src/profile.js");
  const fn = mod.extract_profile || mod.default || mod.extractProfile;
  assert.ok(fn, "extract_profile not found");
  for (const text of ["공공임대 찾아줘", "I want public rental"]) {
    let out;
    assert.doesNotThrow(() => { out = fn(text); });
    const s = JSON.stringify(out ?? "");
    assert.ok(!s.includes('"public"'), `tenure public set for: ${text} -> ${s}`);
  }
});

test("consult tool list has no public tool", async () => {
  const candidates = ["consult/agent.js", "consult/relay.js", "consult/handler.js"];
  let toolNames = [];
  for (const rel of candidates) {
    const p = path.join(srcRoot, rel);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8");
    const re = /["'](find_public_rentals|recommend_public_rental|[^"']*public[^"']*)["']/g;
    let m;
    while ((m = re.exec(src))) toolNames.push(`${rel}:${m[1]}`);
  }
  const hits = toolNames.filter((n) => n.includes("public"));
  // Also try importing SEARCH_TOOL_DEFS if exported
  try {
    const mod = await import("../src/consult/agent.js");
    const defs = mod.SEARCH_TOOL_DEFS || mod.TOOLS || mod.toolDefs || [];
    if (Array.isArray(defs)) {
      for (const d of defs) {
        const nm = d?.name || d?.function?.name || "";
        if (nm.includes("public")) hits.push(`imported:${nm}`);
      }
    }
  } catch {}
  assert.deepEqual(hits, [], `public tools remain: ${hits.join(", ")}`);
});

test("source scan: no public rental strings in web/src", () => {
  const skipDirs = new Set(["i18n"]);
  const allowFile = "homes.js";
  const bad = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(srcRoot, p);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        walk(p);
      } else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) {
        const src = fs.readFileSync(p, "utf8");
        const relPosix = rel.split(path.sep).join("/");
        const isAllow = relPosix === allowFile || relPosix.endsWith("/homes.js");
        const lines = src.split("\n");
        lines.forEach((line, i) => {
          if (line.includes("공공임대") || line.includes("find_public_rentals")) {
            if (isAllow && line.includes("공공임대")) {
              // homes.js exclusion filter allowed only; still flag find_public_rentals
              return;
            }
            bad.push(`${relPosix}:${i + 1}:${line.trim().slice(0, 80)}`);
          }
        });
      }
    }
  };
  walk(srcRoot);
  assert.deepEqual(bad, [], `public rental strings remain:\n${bad.join("\n")}`);
});
