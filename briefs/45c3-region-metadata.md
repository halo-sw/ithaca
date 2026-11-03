# 45c3 — Regional credits and render-clock cleanup

Muse authors code/tests per AGENTS.md. Implement now, first edit within2 calls. One small part. No otherbriefs/subagents/git/network/full tests/build. Exact bounded reads below, then edits. Preserve45a/45b/45c1/45c2.

1. `web/src/ui/store.js` INITIAL_STATE around75–85: add aerialSecondByArea:{} alongside aerial/aerialCorridor; strict set currently drops that destination drape state.
2. `web/src/main.js`: locate only `area: { id:` occurrences in buildUI, bootTour/chat, and sim store (~1250/890/3300; line shifts after45c1). Where loaded area is in scope include actual country and bbox in that object. Do not change numeric data. `web/src/ui/app.jsx:47–54` areaForCredit currently uses money.currency alone. Prefer loaded area's country/bbox or supported US area ID, money only as backward-compatible fallback. Tour in Menlo has no moneyDoc and must still credit USGS/OSM. `app.jsx:1020–1056` SimCredit Korean short string must use USGS forUS. `:1061–1088` AttrLine's isUsd should detect same area metadata; no Korean GIS/VWorld credit onUS. Show imagery credit only when corresponding photo loaded. Keep all layout/components unchanged.
3. `web/src/scene/time.js` (118lines): cache Intl.DateTimeFormat perzone instead of reconstructing each offset call; calendar round-trip validation rejects2026-02-31 (currentlyaccepted). `main.js` updateLighting around2255 calls sceneInstant perframe: cache that absolute Date until day/minute changes (area fixed perpage). Remove unused simInstant import and SUN_DATE if unused. Keeprig.update perframe forcamera, onlyDateconversion cached.

4. Tiny night correctness follow-up: successful drapeAerial sets fringe and roof colour white asynchronously. In BOTH main.js drapeAreaOnce onOk callbacks (home ~460, destination ~3020), call the existing `applyPaintedNight(undefined, true)` after publishing success so the new texture retains the CURRENT night tint. 45c1 added this force API. Otherwise a paused midnight view keeps the white reset until time advances. No data changes.

Tests: new `web/tests/region-metadata-45c.test.js` strictstoreacceptssecondmap; SSR SimCredit with area countryUS or bbox, no moneyDoc→USGS; Korean case→VWorld; no photo→noimageryclaim. Use existingjsx-loader SSRpattern (first30lines of one-map-36c.test.js, only ifneeded). Add Feb31/Apr31 rejection and validleapday toscene-time-45b.test.js. No source-string tests.
Run only newtests +scene-time-45b,ui-store,one-map-36c,us-26e,sim,render-sky. At most2 fixes. Finalfiles+testcounts, no commit.


## Current exact source excerpts — enough context to edit without more reading

Do not spend calls on read_file/search/cat. Use the exact snippets below for edits, write the new tests, then run the named tests.

### web/src/scene/time.js:1
```js
// Regional daylight: render-clock time zone for the loaded scene (45b).
//
// Pure, no DOM, no three.js. The UI clock shows local household time, so
// (dateISO, dayIndex, minuteOfDay) must become the absolute Date the
// sky/solar math (lighting.js, render/sky.js) needs *in the scene's own
// zone*: Asia/Seoul for Korean/default areas, America/Los_Angeles for the
// Bay Area scenes (California / Meta HQ scope, not the whole USA).
//
// Area classification mirrors aerial/drape.js isUsArea (country === "US"
// or bbox centre inside basemap.js US_BBOX); the supported Bay Area scene
// ids are places-us.js US_REGION_IDS. A valid explicit IANA zone carried
// by the area object wins over the classification.
//
// This stays separate from simulation accounting: trips, schedules, saved
// timestamps, replay seeds and sim.js simInstant are untouched — main.js
// calls sceneInstant only where it builds Dates for the sky rig.
//
// DST edge behaviour (documented, deterministic, not a scheduling engine):
// an ambiguous fall-back wall time resolves to the first occurrence
// (daylight side); a nonexistent spring-forward wall time shifts forward
// by the gap via the fixed-point iteration below.

const US_BBOX = [-125, 24, -66, 50]; // same box as basemap.js US_BBOX

export const KOREA_TZ = "Asia/Seoul";
// Only supported US scenes are the Bay Area ones — no USA-wide zone.
export const BAY_TZ = "America/Los_Angeles";
const BAY_IDS = new Set([
  "us-menlo",
  "us-st-san-francisco",
  "us-st-belmont",
  "us-st-san-carlos",
  "us-st-redwood-city",
  "us-st-palo-alto",
  "us-st-mountain-view",
  "us-st-sunnyvale",
]);

function validZone(name) {
  if (typeof name !== "string" || !name) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name }).format(new Date(0));
    return name;
  } catch {
    return null;
  }
}

// sceneTimeZone(area): area object ({id|area, country, bbox, timeZone?}),
// area id string, or zone string. Unknown/missing input is Seoul.
export function sceneTimeZone(area) {
  if (typeof area === "string") {
    return validZone(area) ?? (BAY_IDS.has(area) ? BAY_TZ : KOREA_TZ);
  }
  if (area && typeof area === "object") {
    const explicit = validZone(area.timeZone ?? area.timezone ?? area.tz);
    if (explicit) return explicit;
    const id = area.id ?? area.area;
    if (typeof id === "string" && BAY_IDS.has(id)) return BAY_TZ;
    if (area.country === "US") return BAY_TZ;
    const bb = area.bbox;
    if (Array.isArray(bb) && bb.length >= 4) {
      const lon = (Number(bb[0]) + Number(bb[2])) / 2;
      const lat = (Number(bb[1]) + Number(bb[3])) / 2;
      if (Number.isFinite(lon) && Number.isFinite(lat)
        && lon >= US_BBOX[0] && lon <= US_BBOX[2]
        && lat >= US_BBOX[1] && lat <= US_BBOX[3]) return BAY_TZ;
    }
  }
  return KOREA_TZ;
}

// Zone offset in ms behind UTC for an absolute instant (wall-UTC minus
// instant), via Intl date/time zone offsets. Respects DST.
function zoneOffsetMs(zone, utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1,
    Number(parts.day), Number(parts.hour), Number(parts.minute),
    Number(parts.second));
  return asUtc - utcMs;
}

// sceneInstant(dateISO, day, minute, area): local wall clock on the civil
// date dateISO+day at minute (0–1439) in the scene zone -> absolute Date.
// Throws RangeError on invalid inputs — never NaN into the render loop.
export function sceneInstant(dateISO, day, minute, area) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO ?? ""));
  if (!m) throw new RangeError(`sceneInstant: bad dateISO ${JSON.stringify(dateISO)}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31
    || !Number.isInteger(Date.UTC(y, mo - 1, d))) {
    throw new RangeError(`sceneInstant: bad dateISO ${JSON.stringify(dateISO)}`);
  }
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`sceneInstant: bad day ${JSON.stringify(day)}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 1439) {
    throw new RangeError(`sceneInstant: bad minute ${JSON.stringify(minute)}`);
  }
  const base = new Date(Date.UTC(y, mo - 1, d) + day * 86400000);
  const wallAsUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(),
    base.getUTCDate(), Math.floor(minute / 60), minute % 60, 0);
  const zone = sceneTimeZone(area);
  // Fixed-point utc = wall - offset(utc): exact for normal times,
  // first-occurrence for ambiguous ones, gap-shifted for nonexistent ones.
  let utc = wallAsUtc - zoneOffsetMs(zone, wallAsUtc);
  utc = wallAsUtc - zoneOffsetMs(zone, utc);
  utc = wallAsUtc - zoneOffsetMs(zone, utc);
  return new Date(utc);
}
```

### web/src/ui/store.js:73
```js
  aerial: false, // 20d/20e: true once the VWorld aerial drape lands (set() drops unknown keys)
  aerialCorridor: false, // 36c: true once the ride-corridor drape lands
  pendingScene: null, // 27c2: Muse's open_panel scene effect, consumed by the chat
  profileDetailsRequest: 0, // 29a4: top-bar summary edit button → chat opens the latest 고객님 상황 자세히
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createStore(initial = {}) {
  let state = { ...clone(INITIAL_STATE), ...clone(initial) };
  const listeners = new Set();
  const actions = new Map();
```

### web/src/ui/app.jsx:45
```js
import { aerialCreditFor, USGS_CREDIT } from "../aerial/drape.js";
import { currentLang } from "../i18n/lang.js";

// 26e: the screens below carry no area bbox; a USD moneyDoc marks a US
// run, so the aerial credit maps it to a country-only area (Korean
// runs keep AERIAL_CREDIT).
function areaForCredit(state) {
  return state.money && state.money.currency === "USD" ? { country: "US" } : null;
}
import { priorityValues, myScore } from "../priorities.js";

```

### web/src/ui/app.jsx:1020
```js
// 29L2: on phones (≤ 480 px, CSS picks) the short form shows on one
// line — Korean and English the same — with the full text in title.
export function SimCredit({ state }) {
  // 36c: the aerial part follows the photo the camera is looking at —
  // the station drape outside a ride, the corridor drape during one.
  // 36f: a draped second (workplace) area counts too — VWorld shows
  // when the camera's area is draped.
  const secondDraped = !!(state.aerialSecondByArea
    && Object.keys(state.aerialSecondByArea).length > 0);
  const photo = state.journey ? (state.aerialCorridor || secondDraped) : state.aerial;
  // 36g: English builds the whole line as one string (US areas keep
  // their USGS credit); Korean is unchanged.
  // 36h6: English renders the same full/short pair as Korean so the
  // CSS picks the short form on phones (≤ 480 px).
  if (currentLang() === "en") {
    const area = areaForCredit(state);
    const full = !photo ? "© OpenStreetMap"
      : aerialCreditFor(area) === USGS_CREDIT ? `${USGS_CREDIT} · © OpenStreetMap`
      : "Aerial photo © MOLIT Spatial Information Open Platform (VWorld) · © OpenStreetMap";
    const short = !photo ? "© OpenStreetMap"
      : aerialCreditFor(area) === USGS_CREDIT ? `${USGS_CREDIT} · © OpenStreetMap`
      : "© VWorld · © OpenStreetMap";
    return (
      <div className="ui-simcredit" data-testid="sim-credit" data-no-i18n title={full}>
        <span className="ui-simcredit-full" data-no-i18n>{full}</span>
        <span className="ui-simcredit-short" data-no-i18n>{short}</span>
      </div>
    );
  }
  const full = photo
    ? `${aerialCreditFor(areaForCredit(state))} · © OpenStreetMap`
    : "© OpenStreetMap";
  const short = photo ? "© VWorld · © OpenStreetMap" : "© OpenStreetMap";
  return (
    <div className="ui-simcredit" data-testid="sim-credit" data-no-i18n title={full}>
      <span className="ui-simcredit-full">{full}</span>
      <span className="ui-simcredit-short">{short}</span>
    </div>
  );
}

function AttrLine({ state }) {
  // 26e: a USD run (moneyDoc currency) hides the Korean source line and
  // shows the US line instead.
  const isUsd = state.money && state.money.currency === "USD";
  const money = state.compareTab === "money" || state.compareTab === "quality"
    || state.compareTab === "worthit" || state.compareTab === "support";
  const jeonse = state.compareTab === "jeonse";
  const safety = state.compareTab === "safety" || state.compareTab === "priorities";
  const congestion = state.region && state.region.congestion;
  return (
    <div className="ui-attr">
      <div className="overlay">
        <Text type="supporting">
          {isUsd
            ? "© OpenStreetMap contributors (ODbL) · 지도·항공사진: USGS The National Map · 월세: Zillow ZORI (ZIP 추정, 참고용) · 나무·인물은 장식용 모의 표시"
            : (<>
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors (ODbL) · GIS건물통합정보 (국토교통부/VWorld) · 나무·인물은 장식용 모의 표시
              {money && " · 실거래: 국토교통부 실거래가 공개시스템(참고용)"}
              {jeonse && " · 실거래: 국토교통부 실거래가 공개시스템(참고용) · 등기: GIS건물통합정보 · 체크리스트: 인터넷등기소·정부24·HUG/HF/SGI"}
              {safety && " · 치안: 경찰청 범죄 발생 지역별 통계 (2025년)"}
              {congestion && " · 혼잡도: 서울교통공사 지하철혼잡도정보(2026-09-30 기준, 공공누리 3유형)"}
              {state.aerial && ` · ${aerialCreditFor(areaForCredit(state))}`}
            </>)}
        </Text>
      </div>
    </div>
  );
}

// ?agent=1 (incl. the tour's agent step) shows the tour card — the
```

### web/src/main.js:805
```js
  registerCommonActions();
  store.set({ mode: "chat", area: { id: areaId, label: areaId }, ready: true });
  document.title = "Ithaca — 대화";
```

### web/src/main.js:899
```js
  } else {
    store.set({ area: { id: areaId, label: area.label || areaId } });
    document.title = uiMode === "chat" ? "Ithaca — 대화" : "Ithaca";
```

### web/src/main.js:1262
```js
    areaOptions: AREAS.map((a) => ({ value: a.id, label: a.label })),
    area: { id: areaId, label: area.label || areaId },
    legend: {
```

### web/src/main.js:3438
```js
    scenarioName,
    area: { id: run.meta.area, label: run.meta.area },
    legend: {
```

### web/src/main.js:459
```js
        look: LOOK, style: STYLE },
      onOk: (id, r) => {
        console.log(`[aerial] ok ${r.tiles} tiles z${r.zoom}`);
        store.set({ aerial: true });
      } })
      .then((r) => {
        if (!r || !r.ok) console.log("[aerial] off (no key)");
      })
      .catch(() => console.log("[aerial] off (no key)"));
```

### web/src/main.js:3016
```js
          roofMesh: liteRoof, fringeMesh: fringe, look: LOOK, style: STYLE },
        onOk: (id, r) => {
          console.log(`[aerial] ok ${r.tiles} tiles z${r.zoom} (${id})`);
          store.set({ aerialSecondByArea:
            { ...(store.getState().aerialSecondByArea || {}), [id]: true } });
        } })
        .catch(() => {});
    }
    return { group: g, origin: liteOrigin, nightEntries: liteNightEntries };
```

### web/src/main.js:2261
```js
  let simBloom = 0;
  let simEmissive = 0;
  // 29L1: beacons only after dark — same sky phase the rig already uses.
  let simDark = false;
  let simFramedWidth = null;
  let lastLightKey = "";
  let lastLitKey = "";

  function updateLighting() {
    const m = Math.floor(minute);
    const instant = sceneInstant(run.meta.start_date, day, m, area);
    const camDist = camera.position.distanceTo(controls.target);
    const framedWidth = frameWidthFor(camDist, CAM.fovDeg, camera.aspect);
    simFramedWidth = framedWidth;
    const p = rig.update({ lat: origin.lat, lon: origin.lon, date: instant,
      minute: m,
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      shadowSpan: 240, envKey: `${day}:${Math.floor(m / 30)}`, framedWidth,
      camDistM: camDist, style: STYLE, maxHeightM, look: LOOK });
    simBloom = p.bloom;
    simEmissive = p.emissive;
    simDark = p.phase === "blue" || p.phase === "night";
```

### web/src/main.js:36
```js
import { DECISION_KIND_KO, SIM_TICK_S, SPEEDS, agentLabelOf, chosenLabel, dayDecisions, decisionBadge, formatClock, homeOccupancy, indexRun, latestDecision, optionsLine, parseTParam, sampleAgent, shouldAutoplay, simInstant, tripFractions } from "./sim.js";
```

### web/src/main.js:105
```js
// Fixed autumn-afternoon sun (KST); the solar math itself is unit-tested.
// ?time=HH:MM overrides the tour sun for day/golden/blue/night captures.
const SUN_DATE = new Date("2026-10-15T15:00:00+09:00");
const SUN_MINUTE = 15 * 60;
// Painted leaf colours (14e) read the sim date: the tour's fixed day is
```

Node SSR tests can use register("./jsx-loader.mjs", import.meta.url) from node:module, then dynamic import("react"), import("react-dom/server"), import("../src/ui/app.jsx") (SimCredit export). Existing createStore is exported from ../src/ui/store.js.
