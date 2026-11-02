import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fillLine, fillLines, fillSource, fillTable } from "../src/copy.js";

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
  const nulledStats = { ...stats, jeonse_fraud_victims_2030_pct: null, jeonse_fraud_source: null };
  assert.equal(
    fillLine("{stat:jeonse_fraud_victims_2030_pct}% of victims", nulledStats),
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
  const nulledStats = { ...stats, jeonse_fraud_victims_2030_pct: null, jeonse_fraud_source: null };
  assert.equal(fillSource("{stat:jeonse_fraud_source}", nulledStats), null);
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

test("fillTable fills both cells and drops a null-text row", () => {
  const out = fillTable(
    [
      ["plain label", "text {stat:tests_js}"],
      ["drop me", "gone {stat:rtms_rows}"],
      ["{stat:tests_js} models", "plain text"],
    ],
    stats
  );
  assert.deepEqual(out, [
    ["plain label", `text ${stats.tests_js}`],
    [`${stats.tests_js} models`, "plain text"],
  ]);
});

test("fillTable returns [] when absent", () => {
  assert.deepEqual(fillTable(undefined, stats), []);
});

test("real built-with table: Spark Open row drops when its stat is null", () => {
  const script = JSON.parse(
    readFileSync(join(here, "../data/script.json"), "utf8")
  );
  const scene = script.scenes.find(
    (s) =>
      Array.isArray(s.table_en) &&
      s.table_en.some((row) =>
        row.some(
          (cell) =>
            typeof cell === "string" && cell.includes("{stat:spark_open_same}")
        )
      )
  );
  assert.ok(scene, "expected a scene with a table_en cell containing {stat:spark_open_same}");
  const full = fillTable(scene.table_en, stats);
  assert.equal(full.length, scene.table_en.length);
  const nulled = { ...stats, spark_open_same: null };
  const dropped = fillTable(scene.table_en, nulled);
  assert.equal(dropped.length, full.length - 1);
});
