import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fillLine, fillLines, fillSource } from "../src/copy.js";

const here = dirname(fileURLToPath(import.meta.url));
const stats = JSON.parse(
  readFileSync(join(here, "../data/stats.json"), "utf8")
);

test("fills a single stat", () => {
  assert.equal(fillLine("a {stat:tests_js} b", stats), `a ${stats.tests_js} b`);
});

test("fills two stats in one line", () => {
  const out = fillLine("{stat:tests_js} JS + {stat:tests_py} Python", stats);
  assert.equal(out, `${stats.tests_js} JS + ${stats.tests_py} Python`);
});

test("drops a line whose stat is null", () => {
  assert.equal(
    fillLine("{stat:jeonse_fraud_victims_2030_pct}% of victims", stats),
    null
  );
});

test("drops a line whose stat is missing", () => {
  assert.equal(fillLine("x {stat:no_such_key} y", stats), null);
});

test("drops a line when one of two stats is null", () => {
  assert.equal(
    fillLine("{stat:tests_js} + {stat:rtms_rows} rows", stats),
    null
  );
});

test("leaves a line without placeholders untouched", () => {
  assert.equal(fillLine("plain line", stats), "plain line");
});

test("keeps a zero stat (0 is valid, not missing)", () => {
  assert.equal(fillLine("n={stat:zero}", { zero: 0 }), "n=0");
});

test("fillLines drops only the null lines, leaving no gap", () => {
  const out = fillLines(
    ["keep {stat:tests_js}", "drop {stat:rtms_rows}", "keep2"],
    stats
  );
  assert.deepEqual(out, [`keep ${stats.tests_js}`, "keep2"]);
});

test("fillSource drops a source whose stat is null", () => {
  assert.equal(fillSource("{stat:jeonse_fraud_source}", stats), null);
});

test("fillSource keeps a plain source", () => {
  assert.equal(fillSource("Ministry data, 2025", stats), "Ministry data, 2025");
});

test("never prints null/undefined/empty for missing stats", () => {
  const lines = fillLines(
    ["{stat:rtms_rows_placed_pct}% of {stat:rtms_rows} rows", "ok"],
    stats
  );
  assert.deepEqual(lines, ["ok"]);
  for (const line of lines) {
    assert.ok(!line.includes("null"));
    assert.ok(!line.includes("undefined"));
  }
});

test("real meta rows: last row drops, first three stay", () => {
  const script = JSON.parse(
    readFileSync(join(here, "../data/script.json"), "utf8")
  );
  const meta = script.scenes.find((s) => s.id === "meta");
  const rows = fillLines(meta.rows_en, stats);
  assert.equal(rows.length, 3);
  assert.ok(rows[0].includes(String(stats.muse_stages)));
  assert.ok(rows[1].includes(String(stats.tests_js)));
  assert.ok(rows[2].includes(String(stats.spark_open_judgments)));
});
