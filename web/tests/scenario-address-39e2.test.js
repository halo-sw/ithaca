import test from "node:test";
import assert from "node:assert/strict";
import { parseScenario } from "../src/engine/scenario.js";

function base(home) {
  return {
    household: { members: [{ role: "adult" }] },
    homes: [home],
  };
}

test("parseScenario keeps object address with road (39e2)", () => {
  const out = parseScenario(
    base({
      label: "A",
      area: "tiny",
      complex_name: "알파",
      address: { road: "천호대로157길 45", sigungu: "서울특별시 강동구" },
    }),
  );
  assert.deepEqual(out.homes[0].address, {
    road: "천호대로157길 45",
    sigungu: "서울특별시 강동구",
  });
});

test("parseScenario omits missing/non-object address without throwing (39e2)", () => {
  const out1 = parseScenario(
    base({ label: "A", area: "tiny", complex_name: "알파" }),
  );
  assert.ok(!("address" in out1.homes[0]));
  let out2;
  assert.doesNotThrow(() => {
    out2 = parseScenario(
      base({
        label: "A",
        area: "tiny",
        complex_name: "알파",
        address: "x",
      }),
    );
  });
  assert.ok(!("address" in out2.homes[0]));
});
