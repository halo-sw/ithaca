// Lists video/public/clips/ into video/src/assets.generated.json so scenes can
// tell a recorded clip from a missing one without touching the network.
// Run from prestudio / prestill / prerender; new clips drop in with no code
// change. A missing clips/ dir means every screen scene shows its placeholder.
import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const clipsDir = join(here, "../public/clips");
const outFile = join(here, "../src/assets.generated.json");

async function walk(dir, prefix) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = await walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      out.push(...sub);
    } else if (entry.isFile()) {
      out.push(`${prefix}${entry.name}`);
    }
  }
  return out;
}

export async function regenerateAssets() {
  let files = [];
  try {
    files = await walk(clipsDir, "clips/");
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      throw err;
    }
    files = [];
  }
  files.sort();
  await writeFile(outFile, `${JSON.stringify({ files }, null, 2)}\n`);
  return files;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const files = await regenerateAssets();
  console.log(`assets: ${files.length} file(s) under public/clips/`);
  for (const f of files) {
    console.log(`  ${f}`);
  }
}
