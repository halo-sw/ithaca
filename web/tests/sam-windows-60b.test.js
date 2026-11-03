// Stage 60b1: SAM 3.1 finds windows in a room photo (server side).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SAM_MODEL,
  PHOTO_MAX_BYTES,
  WINDOW_MIN_SCORE,
  WINDOW_MIN_FRAC,
  parseSamBoxes,
  windowsSummary,
  buildSamBody,
  imageMime,
  createWindowsHandler,
} from "../src/consult/windows.js";
import { createRelay } from "../../relay/handler.js";

const MEASURED = "<0f>0<|box;x1=261;y1=107;x2=715;y2=926;w=1600;h=1600;c=0.921951174736023|><|mask;x=0;y=0;c=0.921951174736023;data=820,455,!!!!&??c3Znc|>,1<|box;x1=881;y1=111;x2=1343;y2=913;w=1600;h=1600;c=0.9179486632347107|><|mask;x=0;y=0;c=0.9179486632347107;data=803,463,!!!!%k8:E^Zy|>\n";

function jpegBytes(size = 64) {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(Math.max(0, size - 3), 1)]);
}

function mockRes() {
  let resolve;
  const done = new Promise((r) => {
    resolve = r;
  });
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(k, v) {
      res.headers[k] = v;
    },
    end(chunk) {
      if (chunk) res.body += chunk;
      resolve(res);
    },
  };
  return { res, done };
}

function samOkFetch(seen) {
  return async (url, opts) => {
    if (seen) {
      seen.url = url;
      seen.auth = opts.headers.Authorization;
      seen.body = JSON.parse(opts.body);
    }
    return {
      status: 200,
      json: async () => ({
        output: [{ type: "message", content: [{ type: "output_text", text: MEASURED }] }],
      }),
    };
  };
}

describe("60b1 parseSamBoxes", () => {
  it("reads the measured text", () => {
    assert.equal(SAM_MODEL, "sam-3.1");
    assert.equal(PHOTO_MAX_BYTES, 4_000_000);
    assert.equal(WINDOW_MIN_SCORE, 0.5);
    const boxes = parseSamBoxes(MEASURED);
    assert.equal(boxes.length, 2);
    assert.deepEqual(boxes[0].bbox, [261, 107, 716, 927]);
    assert.equal(boxes[0].frameW, 1600);
    assert.equal(boxes[0].frameH, 1600);
    assert.ok(Math.abs(boxes[0].score - 0.922) < 0.001);
  });
});

describe("60b1 windowsSummary", () => {
  it("drops a low-score box", () => {
    const boxes = parseSamBoxes(MEASURED).concat([
      { id: 2, bbox: [0, 0, 10, 10], frameW: 1600, frameH: 1600, score: 0.3 },
    ]);
    const s = windowsSummary(boxes);
    assert.equal(s.windows.length, 2);
  });

  it("unions two overlapping 10x10 boxes", () => {
    const boxes = [
      { id: 0, bbox: [0, 0, 10, 10], frameW: 100, frameH: 100, score: 0.9 },
      { id: 1, bbox: [5, 0, 15, 10], frameW: 100, frameH: 100, score: 0.9 },
    ];
    const s = windowsSummary(boxes);
    assert.equal(s.unionFrac, 0.015);
  });

  it("summarises the measured pair", () => {
    const s = windowsSummary(parseSamBoxes(MEASURED));
    assert.equal(s.windows.length, 2);
    assert.equal(s.unionFrac, 0.291);
  });
});

describe("60b3 windowsSummary filters", () => {
  it("drops a tiny nested latch, keeps the two windows", () => {
    assert.equal(WINDOW_MIN_FRAC, 0.005);
    const boxes = [
      { id: 0, bbox: [261, 107, 718, 928], frameW: 1600, frameH: 1600, score: 0.922 },
      { id: 1, bbox: [881, 113, 1343, 916], frameW: 1600, frameH: 1600, score: 0.918 },
      { id: 2, bbox: [640, 742, 663, 778], frameW: 1600, frameH: 1600, score: 0.515 },
    ];
    const s = windowsSummary(boxes);
    assert.equal(s.windows.length, 2);
    assert.deepEqual(s.windows.map((w) => w.bbox), [
      [261, 107, 718, 928],
      [881, 113, 1343, 916],
    ]);
    assert.equal(s.unionFrac, 0.291);
  });

  it("drops a lone tiny box covering 0.3% of the frame", () => {
    const boxes = [
      { id: 0, bbox: [0, 0, 5, 6], frameW: 100, frameH: 100, score: 0.95 },
    ];
    const s = windowsSummary(boxes);
    assert.equal(s.windows.length, 0);
  });

  it("drops a box 95% inside a bigger kept box", () => {
    const boxes = [
      { id: 0, bbox: [0, 0, 50, 50], frameW: 100, frameH: 100, score: 0.95 },
      { id: 1, bbox: [2, 2, 48, 48], frameW: 100, frameH: 100, score: 0.95 },
    ];
    const s = windowsSummary(boxes);
    assert.equal(s.windows.length, 1);
    assert.deepEqual(s.windows[0].bbox, [0, 0, 50, 50]);
  });
});

describe("60b1 handler", () => {
  it("answers 200 and posts the SAM body upstream", async () => {
    const seen = {};
    const handler = createWindowsHandler({
      env: { META_API_KEY: "test-key" },
      fetchImpl: samOkFetch(seen),
    });
    const { res, done } = mockRes();
    await handler({ method: "POST", body: jpegBytes() }, res);
    const finished = await done;
    assert.equal(finished.statusCode, 200);
    const json = JSON.parse(finished.body);
    assert.equal(json.count, 2);
    assert.equal(json.model, "sam-3.1");
    assert.equal(seen.body.model, "sam-3.1");
    const content = seen.body.input[0].content;
    assert.equal(content.find((c) => c.type === "input_text").text, "window");
    const img = content.find((c) => c.type === "input_image").image_url;
    assert.ok(img.startsWith("data:image/jpeg;base64,"));
    assert.equal(seen.body.metadata.include_confidence, "true");
    assert.equal(seen.auth, "Bearer test-key");
  });

  it("rejects oversize, bad image, no key and upstream failures", async () => {
    const keyed = (fetchImpl) =>
      createWindowsHandler({ env: { META_API_KEY: "test-key" }, fetchImpl });
    {
      const { res, done } = mockRes();
      await keyed(samOkFetch())({ method: "POST", body: Buffer.alloc(4_000_001, 1) }, res);
      assert.equal((await done).statusCode, 413);
    }
    {
      const { res, done } = mockRes();
      await keyed(samOkFetch())({ method: "POST", body: Buffer.from("GIF89a....", "utf8") }, res);
      const finished = await done;
      assert.equal(finished.statusCode, 400);
      assert.equal(JSON.parse(finished.body).error, "bad_image");
    }
    {
      const handler = createWindowsHandler({ env: {}, fetchImpl: samOkFetch() });
      const { res, done } = mockRes();
      await handler({ method: "POST", body: jpegBytes() }, res);
      assert.equal((await done).statusCode, 503);
    }
    {
      const handler = keyed(async () => {
        throw new Error("boom");
      });
      const { res, done } = mockRes();
      await handler({ method: "POST", body: jpegBytes() }, res);
      assert.equal((await done).statusCode, 502);
    }
    {
      const handler = keyed(async () => ({ status: 500, json: async () => ({}) }));
      const { res, done } = mockRes();
      await handler({ method: "POST", body: jpegBytes() }, res);
      const finished = await done;
      assert.equal(finished.statusCode, 502);
      assert.equal(JSON.parse(finished.body).status, 500);
    }
  });

  it("exposes imageMime and buildSamBody", () => {
    assert.equal(imageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(imageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00])), "image/png");
    assert.equal(imageMime(Buffer.from("GIF8", "utf8")), null);
    const body = buildSamBody(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
    assert.equal(body.model, "sam-3.1");
  });
});

describe("60b1 relay windows route", () => {
  function winReq(body, client = "7.7.7.7") {
    return {
      method: "POST",
      url: "/api/vision/windows",
      headers: { origin: "https://halo-sw.github.io" },
      socket: { remoteAddress: client },
      body,
    };
  }

  it("405 on GET", async () => {
    const relay = createRelay({ env: { META_API_KEY: "test-key" }, fetchImpl: samOkFetch() });
    const { res, done } = mockRes();
    await relay(
      {
        method: "GET",
        url: "/api/vision/windows",
        headers: { origin: "https://halo-sw.github.io" },
        socket: { remoteAddress: "7.7.7.7" },
      },
      res,
    );
    assert.equal((await done).statusCode, 405);
  });

  it("rate-limits the 11th POST in 10 minutes", async () => {
    let calls = 0;
    const fake = async () => {
      calls += 1;
      return {
        status: 200,
        json: async () => ({
          output: [{ type: "message", content: [{ type: "output_text", text: MEASURED }] }],
        }),
      };
    };
    const relay = createRelay({ env: { META_API_KEY: "test-key" }, fetchImpl: fake });
    for (let i = 0; i < 10; i++) {
      const { res, done } = mockRes();
      await relay(winReq(jpegBytes()), res);
      assert.equal((await done).statusCode, 200);
    }
    assert.equal(calls, 10);
    const { res, done } = mockRes();
    await relay(winReq(jpegBytes()), res);
    assert.equal((await done).statusCode, 429);
    assert.equal(calls, 10);
  });
});
