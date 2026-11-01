import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rtmsDistrictForArea } from "../src/consult/tools-money.js";

describe("home boxes 38a", () => {
  it("resolves hm- ids via home_boxes region", async () => {
    const session = {
      loadStationBoxes: async () => ({
        boxes: [],
        home_boxes: [{ id: "hm-gangdong-01", region: "gangdong" }],
      }),
    };
    assert.equal(await rtmsDistrictForArea(session, "hm-gangdong-01"), "gangdong");
  });
});
