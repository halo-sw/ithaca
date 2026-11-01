// Stage 38b — lines 1/4/6/gyeongui/arex/uisinseol/sillim join the network:
// app colours + Seoul Station / Sangam workplace aliases.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LINE_COLORS } from "../src/chatmap.js";
import { extract_profile } from "../src/profile.js";

describe("38b LINE_COLORS", () => {
  it("has the 7 new ids with the official hex values", () => {
    const ids = ["line1", "line4", "line6", "gyeongui", "arex", "uisinseol", "sillim"];
    assert.deepEqual(
      Object.fromEntries(Object.entries(LINE_COLORS).filter(([k]) => ids.includes(k))),
      {
        line1: "#0052A4",
        line4: "#00A5DE",
        line6: "#CD7C2F",
        gyeongui: "#77C4A3",
        arex: "#0090D2",
        uisinseol: "#B0CE18",
        sillim: "#6789CA",
      });
  });
});

describe("38b workplace aliases", () => {
  it("서울역으로 출근 resolves to the Seoul Station name (서울)", () => {
    const { profile } = extract_profile("서울역으로 출근하는 1인 가구예요", null,
      { stations: ["서울역", "판교"] });
    assert.equal(profile.workplaces.value[0].resolved.station, "서울");
  });
  it("상암 DMC로 출근 resolves to 디지털미디어시티", () => {
    const { profile } = extract_profile("상암 DMC로 출근해요", null,
      { stations: ["디지털미디어시티"] });
    assert.equal(profile.workplaces.value[0].resolved.station, "디지털미디어시티");
  });
  it("I work near Seoul Station resolves too (English path)", () => {
    const { profile } = extract_profile("I work near Seoul Station", null,
      { stations: ["서울역", "판교"] });
    assert.equal(profile.workplaces.value[0].resolved.station, "서울");
  });
});
