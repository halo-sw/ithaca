// 38d: box files (/data/st-*/.., /data/hm-*/..) ship gzipped; the app
// decompresses .gz itself, non-box files stay plain.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { fetchDataJson, isBoxDataUrl } from "../src/data-fetch.js";
import { httpReadText } from "../src/consult/server.js";
import { runtimeDataList, walkFs } from "../scripts/runtime-data-list.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

describe("38d isBoxDataUrl", () => {
  it("matches box files including URL-encoded ids", () => {
    for (const u of [
      "/ithaca/data/st-판교/area.json",
      "/data/hm-gangdong-01/scene.json",
      "/data/st-%EA%B0%95%EB%82%A8/area.buildings.json",
    ]) assert.equal(isBoxDataUrl(u), true, u);
  });
  it("rejects non-box files", () => {
    for (const u of [
      "/data/homes/gangnam.json",
      "/data/region/network.json",
      "/data/st-판교/extract.osm.pbf",
    ]) assert.equal(isBoxDataUrl(u), false, u);
  });
});

describe("38d fetchDataJson", () => {
  const boxUrl = "https://x.test/data/st-a/area.json";
  const gzBody = gzipSync(JSON.stringify({ a: 1 }));
  function fake(gzStatus = 200) {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url.endsWith(".gz")) {
        if (gzStatus !== 200) return new Response("no", { status: gzStatus });
        return new Response(gzBody);
      }
      return new Response(JSON.stringify({ plain: true }), {
        headers: { "content-type": "application/json" },
      });
    };
    return { seen, fetchImpl };
  }
  it("(a) gz hit returns parsed json without touching plain", async () => {
    const { seen, fetchImpl } = fake();
    assert.deepEqual(await fetchDataJson(boxUrl, { fetchImpl, gz: true }), { a: 1 });
    assert.deepEqual(seen, [`${boxUrl}.gz`]);
  });
  it("(b) gz 404 falls back to plain", async () => {
    const { seen, fetchImpl } = fake(404);
    assert.deepEqual(await fetchDataJson(boxUrl, { fetchImpl, gz: true }), { plain: true });
    assert.deepEqual(seen, [`${boxUrl}.gz`, boxUrl]);
  });
  it("(c) gz off fetches plain only", async () => {
    const { seen, fetchImpl } = fake();
    assert.deepEqual(await fetchDataJson(boxUrl, { fetchImpl, gz: false }), { plain: true });
    assert.deepEqual(seen, [boxUrl]);
  });
  it("(d) non-box url with gz on stays plain", async () => {
    const { seen, fetchImpl } = fake();
    const url = "https://x.test/data/homes/gangnam.json";
    assert.deepEqual(await fetchDataJson(url, { fetchImpl, gz: true }), { plain: true });
    assert.deepEqual(seen, [url]);
  });
});

describe("38d httpReadText", () => {
  it("reads box files from .gz, other trees plain", async () => {
    const text = JSON.stringify({ box: 1 });
    const seen = [];
    const fake = async (url) => {
      seen.push(url);
      if (url === "https://x.test/data/st-판교/area.json.gz") return new Response(gzipSync(text));
      if (url === "https://x.test/data/homes/gangnam.json") return new Response("IDX");
      return new Response("no", { status: 404 });
    };
    const read = httpReadText("https://x.test", fake);
    assert.equal(await read("data", "st-판교/area.json"), text);
    assert.equal(await read("data", "homes/gangnam.json"), "IDX");
    assert.ok(!seen.some((u) => u.endsWith("homes/gangnam.json.gz")));
  });
});

describe("38d gzip-boxes.mjs", () => {
  it("gzips box trees only and is idempotent", () => {
    const dir = mkdtempSync(join(tmpdir(), "gz38d-"));
    mkdirSync(join(dir, "st-x"), { recursive: true });
    mkdirSync(join(dir, "hm-y"), { recursive: true });
    mkdirSync(join(dir, "homes"), { recursive: true });
    const area = JSON.stringify({ a: "x".repeat(2000) });
    const scene = JSON.stringify({ s: "y".repeat(2000) });
    writeFileSync(join(dir, "st-x", "area.json"), area);
    writeFileSync(join(dir, "hm-y", "scene.json"), scene);
    writeFileSync(join(dir, "homes", "a.json"), "{}");
    const script = join(HERE, "..", "scripts", "gzip-boxes.mjs");
    const run = () => execFileSync(process.execPath, [script, dir], { encoding: "utf8" });
    const out = JSON.parse(run());
    assert.equal(out.files, 2);
    assert.ok(out.bytes_before > out.bytes_after);
    for (const [rel, orig] of [["st-x/area.json", area], ["hm-y/scene.json", scene]]) {
      assert.ok(!existsSync(join(dir, rel)), rel);
      assert.equal(gunzipSync(readFileSync(join(dir, `${rel}.gz`))).toString("utf8"), orig);
    }
    assert.equal(readFileSync(join(dir, "homes", "a.json"), "utf8"), "{}");
    assert.equal(JSON.parse(run()).files, 0);
  });
});

describe("38d runtimeDataList via walkFs", () => {
  it("lists files through a symlinked box dir", async () => {
    const dir = mkdtempSync(join(tmpdir(), "walk38d-"));
    mkdirSync(join(dir, "real"));
    writeFileSync(join(dir, "real", "area.json"), JSON.stringify({ buildings: [] }));
    symlinkSync(join(dir, "real"), join(dir, "st-x"), "dir");
    const into = [];
    await walkFs(dir, "", into);
    assert.ok(into.includes("st-x/area.json"), JSON.stringify(into));
    const reader = {
      files: into,
      readJson: async (rel) => JSON.parse(readFileSync(join(dir, rel), "utf8")),
    };
    assert.ok((await runtimeDataList(reader)).includes("st-x/area.json"));
  });
});

describe("38d sources route box fetches", () => {
  it("box fetch sites import the gz helper", () => {
    for (const f of ["sim-worker.js", "ui/chat.jsx", "ui/preview.jsx", "main.js"]) {
      assert.match(readFileSync(join(SRC, f), "utf8"), /fetchDataJson|fetchDataText/, f);
    }
  });
});
