#!/usr/bin/env node
// Stage 39a — isomap shooting script: shoot the 3D page in ?isomap=1
// mode tile by tile and save square PNGs + a manifest.
// Usage:
//   node web/scripts/isomap-shoot.mjs --base http://localhost:48750/ \
//     --out <dir> --area <id> --lon <lon> --lat <lat> \
//     [--span 240] [--grid 1|2|3] [--overlap 0.15]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isomapDataUrlToBuffer, isomapTileCenters, parseIsomapParams } from '../src/isomap.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function argVal(args, name, def = undefined) {
  const ix = args.indexOf(name);
  if (ix < 0) return def;
  return args[ix + 1];
}

export { isomapTileCenters };

export function tileUrl(base, { area, lon, lat, span, az = 45, el = 35, px = 1024 }) {
  const q = new URLSearchParams({
    isomap: '1', area, lon: String(lon), lat: String(lat),
    span: String(span), az: String(az), el: String(el), px: String(px),
  });
  return `${String(base).replace(/\/$/, '')}/?${q.toString()}`;
}

export function parseShootArgs(argv) {
  const iso = parseIsomapParams(new URLSearchParams());
  return {
    base: argVal(argv, '--base', 'http://localhost:48750/'),
    out: argVal(argv, '--out', null),
    area: argVal(argv, '--area', ''),
    lon: parseFloat(argVal(argv, '--lon', 'NaN')),
    lat: parseFloat(argVal(argv, '--lat', 'NaN')),
    span: parseFloat(argVal(argv, '--span', '240')),
    grid: parseInt(argVal(argv, '--grid', '1'), 10) || 1,
    overlap: parseFloat(argVal(argv, '--overlap', '0.15')),
    az: iso.az,
    el: iso.el,
    px: iso.px,
  };
}

async function main() {
  const o = parseShootArgs(process.argv.slice(2));
  if (!o.out || !o.area || !Number.isFinite(o.lon) || !Number.isFinite(o.lat)) {
    console.error('usage: isomap-shoot.mjs --base <url> --out <dir> --area <id> --lon <lon> --lat <lat> [--span 240] [--grid N] [--overlap 0.15]');
    process.exit(2);
  }
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
  });
  try {
    await fs.mkdir(o.out, { recursive: true });
    const tiles = isomapTileCenters({ lon: o.lon, lat: o.lat, span: o.span, grid: o.grid, overlap: o.overlap });
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
    const manifest = [];
    for (const t of tiles) {
      const url = tileUrl(o.base, { area: o.area, lon: t.lon, lat: t.lat, span: o.span });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__isomap && window.__isomap.ready === true, null, { timeout: 90000 });
      const state = await page.evaluate(() => window.__isomap);
      const file = `${o.area}_${t.r}_${t.c}.png`;
      if (!state || !state.ok) {
        console.error(`skip ${file}: ${state && state.reason ? state.reason : 'not-ok'}`);
        continue;
      }
      const dataUrl = await page.evaluate(() => window.__isomapShot());
      await fs.writeFile(path.join(o.out, file), isomapDataUrlToBuffer(dataUrl));
      manifest.push({ file, area: o.area, lon: t.lon, lat: t.lat, span: o.span, az: 45, el: 35, credit: state && state.credit, ok: !!(state && state.ok) });
    }
    await fs.writeFile(path.join(o.out, `${o.area}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(HERE, 'isomap-shoot.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
void HERE;
