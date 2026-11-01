// 38d: gzip box payloads before packing the release asset.
//
// Usage: node web/scripts/gzip-boxes.mjs <dir>
//
// For every file under <dir>/st-*/ and <dir>/hm-*/ ending in .json, writes
// <file>.gz (gzip level 9) and deletes the .json. Other trees (homes/,
// region/, sim/, ...) stay plain. Idempotent: an existing .gz with no .json
// is left alone. Prints { files, bytes_before, bytes_after } as JSON.
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

function isBoxTop(name) {
  return name.startsWith("st-") || name.startsWith("hm-");
}

async function gzipTree(dir, tally) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    const s = await stat(full);
    if (s.isDirectory()) {
      await gzipTree(full, tally);
    } else if (s.isFile() && full.endsWith(".json")) {
      const raw = await readFile(full);
      const gz = gzipSync(raw, { level: 9 });
      await writeFile(`${full}.gz`, gz);
      await unlink(full);
      tally.files += 1;
      tally.bytes_before += raw.length;
      tally.bytes_after += gz.length;
    }
  }
}

const root = process.argv[2];
if (!root) {
  console.error("usage: gzip-boxes.mjs <dir>");
  process.exit(1);
}
const tally = { files: 0, bytes_before: 0, bytes_after: 0 };
for (const e of await readdir(root, { withFileTypes: true })) {
  if (!isBoxTop(e.name)) continue;
  const full = join(root, e.name);
  if ((await stat(full)).isDirectory()) await gzipTree(full, tally);
}
console.log(JSON.stringify(tally));
