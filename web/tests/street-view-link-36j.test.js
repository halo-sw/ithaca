// Stage 36j: cards without a street photo link out to Kakao Map Roadview
// (Korea) / Google Street View (US). Plain outbound links only — no
// Kakao/Google imagery is fetched or embedded.
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader.mjs", import.meta.url);

// .jsx loads dynamically (static imports resolve before the loader).
let React;
let renderToString;
let CandidateCard;
let streetViewLinkFor;

function baseCandidate(over) {
  return { id: "t1", name: "테스트집", kind: "오피스텔",
    lon: 127.1, lat: 37.4, build_year: 2003,
    tenures: [{ tenure: "jeonse", median_won: 177000000,
      min_won: 170000000, max_won: 190000000, deals: 7,
      budget_fit: "all", bucket_center_m2: 30 }],
    commute: { walk: { known: true, station: "야탑", minutes: 4 },
      ride: { known: false } },
    ...over };
}

const noop = () => {};

function rowHtml(candidate, extra = {}) {
  return renderToString(React.createElement(CandidateCard,
    { candidate, tenure: "jeonse", destName: "판교", photos: null,
      index: 0, picked: false, onLive: noop, onJeonse: noop,
      onDetail: noop, ...extra }));
}

before(async () => {
  React = (await import("react")).default;
  ({ renderToString } = await import("react-dom/server"));
  ({ CandidateCard, streetViewLinkFor } = await import("../src/ui/candidate-card.jsx"));
});

describe("36j streetViewLinkFor", () => {
  it("다누림빌 (gangnam) links to Kakao roadview", () => {
    const link = streetViewLinkFor({ lon: 127.030673, lat: 37.5222776 });
    assert.equal(link.href,
      "https://map.kakao.com/link/roadview/37.522278,127.030673");
    assert.equal(link.label, "카카오맵 로드뷰로 보기");
  });

  it("산성역 home (sujeong) links to Kakao roadview", () => {
    const link = streetViewLinkFor({ lon: 127.1544264, lat: 37.4571344 });
    assert.equal(link.href,
      "https://map.kakao.com/link/roadview/37.457134,127.154426");
    assert.equal(link.label, "카카오맵 로드뷰로 보기");
  });

  it("US home links to the Google pano URL", () => {
    const link = streetViewLinkFor({ lon: -122.1633463, lat: 37.4436871 });
    assert.equal(link.href,
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=37.443687,-122.163346");
    assert.equal(link.label, "Google 스트리트 뷰로 보기");
  });

  it("missing lon/lat returns null", () => {
    assert.equal(streetViewLinkFor({}), null);
    assert.equal(streetViewLinkFor({ lon: 127.0 }), null);
    assert.equal(streetViewLinkFor(null), null);
  });
});

describe("36j card street-view link", () => {
  it("row without a street photo shows the link with target/rel", () => {
    const html = rowHtml(baseCandidate({ id: "home-004928",
      lon: 127.030673, lat: 37.5222776 }));
    assert.ok(html.includes(
      "https://map.kakao.com/link/roadview/37.522278,127.030673"),
      "kakao roadview href");
    assert.ok(html.includes('target="_blank"'), "opens in a new tab");
    assert.ok(/rel="[^"]*noopener[^"]*"/.test(html), "rel contains noopener");
  });

  it("row with a street photo shows no link", () => {
    const html = rowHtml(
      baseCandidate({ id: "home-004928", lon: 127.030673, lat: 37.5222776 }),
      { street: { id: "m1", thumb_url: "https://example.com/t.jpg",
        url: "https://example.com/f.jpg", page_url: null,
        creator: "Mapillary" } });
    assert.ok(!html.includes("map.kakao.com/link/roadview"),
      "no roadview link with a street photo");
    assert.ok(!html.includes("google.com/maps"), "no street view link");
  });
});
