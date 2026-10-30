// One still per scene (2 s in) into video/out/stills/<id>.png for look review.
// Usage: npm run stills [-- --scale=0.5]   (extra args pass to `remotion still`)
//        node scripts/stills.mjs --dry-run  (print the frames, render nothing)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { regenerateAssets } from "./assets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const videoDir = join(here, "..");
const script = JSON.parse(
  readFileSync(join(videoDir, "data/script.json"), "utf8")
);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const extra = args.filter((a) => a !== "--dry-run");

await regenerateAssets();
const outDir = join(videoDir, "out/stills");
mkdirSync(outDir, { recursive: true });

for (const scene of script.scenes) {
  const frame = Math.round((scene.start + 2) * script.fps);
  const out = join(outDir, `${scene.id}.png`);
  const cmd = [
    "remotion",
    "still",
    "src/index.js",
    "Demo",
    out,
    `--frame=${frame}`,
    "--overwrite",
    ...extra,
  ];
  console.log(`still ${scene.id}: frame ${frame} -> out/stills/${scene.id}.png`);
  if (dryRun) {
    console.log(`  npx ${cmd.join(" ")}`);
    continue;
  }
  const result = spawnSync("npx", cmd, { cwd: videoDir, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`stills: scene ${scene.id} failed (exit ${result.status})`);
    process.exit(1);
  }
}
console.log(dryRun ? "dry run: no stills rendered" : "stills: done");
