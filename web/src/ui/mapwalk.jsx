// Stage 38c: follow the same 30-day run on a flat map instead of 3D.
// Parses the scene URL (custom/home/day), waits on runReady like
// SceneFrame, then draws that day's walk + ride segments over the
// VWorld white tiles with fitMapView. No keys, no stored geocoder.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { loadCustomRun } from "../chat/idb.js";
import { loadBoxArea, NETWORK_URL } from "../chat/engine.js";
import { fetchDataJson } from "../data-fetch.js";
import { fitMapView, lineColorFor, findStop } from "../chatmap.js";
import { basemapApiBase, basemapTileUrl, basemapTiles,
  basemapUnderlayTiles, basemapProvider } from "../basemap.js";
import { dayTimeline, positionAt, activityLine, parseMapWalkMinute,
  stationLabelsFor, placeLabels } from "../mapwalk.js";

// 38c4: SSR fallback box (4:3); the live box comes from the wrapper.
const FALLBACK_W = 400;
const FALLBACK_H = 300;

export function parseMapWalkUrl(url) {
  try {
    const q = String(url || "").split("?")[1] || "";
    const p = new URLSearchParams(q);
    return {
      custom: p.get("custom"),
      home: p.get("home") || "A",
      day: Number(p.get("day")) || 1,
      follow: Number(p.get("follow")) || 1,
      startMinute: parseMapWalkMinute(p.get("t")),
    };
  } catch {
    return { custom: null, home: "A", day: 1, follow: 1, startMinute: null };
  }
}

function ptsAttr(pts, toXY) {
  return pts.map(([lon, lat]) => {
    const [x, y] = toXY(lon, lat);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

// The black work square marks a work stay only. Other stays are a
// small grey dot, and nothing when they sit on the home pin.
export function StayMark({ seg, x, y, homeCoord }) {
  if (!seg || seg.kind !== "stay" || !Array.isArray(seg.pts) || !seg.pts[0]) return null;
  if (seg.awayKind === "work") {
    return (
      <g>
        <rect x={x - 6} y={y - 6} width={12} height={12} fill="#111827" />
      </g>
    );
  }
  const p = seg.pts[0];
  if (homeCoord && p[0] === homeCoord[0] && p[1] === homeCoord[1]) return null;
  return (
    <g>
      <circle cx={x} cy={y} r={3} fill="#9ca3af" />
    </g>
  );
}

export function MapWalk({ url, lang = "ko", phone = false, runReady, fixture }) {
  const en = lang === "en";
  const parsed = useMemo(() => parseMapWalkUrl(url), [url]);
  const [runState, setRunState] = useState(
    runReady === false ? "failed" : (runReady === undefined || runReady === true ? "ready" : "pending"));
  useEffect(() => {
    if (runReady === undefined || typeof runReady === "boolean") {
      setRunState(runReady === false ? "failed" : "ready");
      return undefined;
    }
    let live = true;
    setRunState("pending");
    Promise.resolve(runReady).then((v) => {
      if (live) setRunState(v ? "ready" : "failed");
    }, () => {
      if (live) setRunState("failed");
    });
    return () => { live = false; };
  }, [runReady]);
  const [day, setDay] = useState(parsed.day);
  // 38c4: `fixture` is ready-made `data` (SSR/tests) — it skips the load.
  const [data, setData] = useState(fixture || null);
  const [minute, setMinute] = useState(parsed.startMinute ?? null);
  const [playing, setPlaying] = useState(false);
  const [follow, setFollow] = useState(false);

  useEffect(() => {
    if (fixture) { setData(fixture); return undefined; }
    if (runState !== "ready" || !parsed.custom) return undefined;
    let live = true;
    (async () => {
      try {
        const saved = await loadCustomRun(parsed.custom);
        if (!live) return;
        if (!saved) { setData({ missing: true }); return; }
        const labels = saved.labels || ["A", "B"];
        const homeLabel = labels.includes(parsed.home) ? parsed.home : labels[0];
        const run = (saved.runs || {})[homeLabel] || null;
        const homes = (saved.scenario && saved.scenario.homes) || [];
        const homeEntry = homes.find((h) => h && (h.label === homeLabel || h.id === homeLabel))
          || homes[labels.indexOf(homeLabel)] || homes[0] || null;
        const areaIds = new Set();
        if (homeEntry && homeEntry.area) areaIds.add(homeEntry.area);
        for (const t of ((run && run.trips) || [])) {
          if (t && t.graph_area) areaIds.add(t.graph_area);
        }
        const areas = {};
        for (const aid of areaIds) {
          try {
            areas[aid] = await loadBoxArea(fetchDataJson, aid);
          } catch {
            // A missing area just skips walk shapes for that leg.
          }
        }
        let network = null;
        try {
          network = await fetchDataJson(NETWORK_URL);
        } catch {
          network = null;
        }
        if (live) setData({ saved, run, homeLabel, homeEntry, areas, network });
      } catch {
        if (live) setData({ missing: true });
      }
    })();
    return () => { live = false; };
  }, [runState, parsed.custom, parsed.home, fixture]);

  const days = (data && data.saved && data.saved.scenario && data.saved.scenario.days) || 30;

  const tl = useMemo(() => {
    if (!data || !data.run) return { segments: [], others: [] };
    const homeAreaId = data.homeEntry && data.homeEntry.area;
    const nodeCoordsFor = (nid, trip) => {
      const aid = (trip && trip.graph_area) || homeAreaId;
      const c = aid && data.areas[aid] && data.areas[aid].graph
        && data.areas[aid].graph.nodes[String(nid)];
      return Array.isArray(c) ? c : null;
    };
    const stationCoord = (name) => {
      const s = data.network ? findStop(data.network, name) : null;
      return s ? [s.lon, s.lat] : null;
    };
    let agents;
    const keys = ((data.run && data.run.agents) || [])
      .filter((a) => a && a.household).map((a) => a.key);
    if (keys.length) {
      const f = Math.min(Math.max(parsed.follow || 1, 1), keys.length);
      agents = [keys[f - 1], ...keys.filter((k) => k !== keys[f - 1])];
    }
    return dayTimeline(data.run, { day: day - 1, agents, nodeCoordsFor, stationCoord, network: data.network });
  }, [data, day, parsed.follow]);

  const segments = tl.segments || [];
  const t0 = segments.length ? segments[0].t0 : 0;
  const t1 = segments.length ? segments[segments.length - 1].t1 : 0;
  const effMinute = minute == null ? t0 : Math.min(Math.max(minute, t0), t1);
  const pos = segments.length ? positionAt(segments, effMinute) : null;

  useEffect(() => {
    if (!playing || !segments.length) return undefined;
    const id = setInterval(() => {
      setMinute((m) => (m == null ? t0 + 1 : m + 1));
    }, 100);
    return () => clearInterval(id);
  }, [playing, segments.length, t0]);

  useEffect(() => {
    if (playing && segments.length && effMinute >= t1) setPlaying(false);
  }, [playing, effMinute, t1, segments.length]);

  // 38c4: the SVG fills the panel — measure the wrapper so the
  // viewBox matches the real box (4:3 fallback in SSR).
  const wrapRef = useRef(null);
  const [box, setBox] = useState(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0] && entries[0].contentRect;
      if (r && r.width > 1 && r.height > 1) {
        setBox((b) => (b && Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1
          ? b : { w: r.width, h: r.height }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  if (runState === "pending") {
    return (
      <p className="ui-mapwalk-pending" data-no-i18n style={{ textAlign: "center", fontSize: 14 }}>
        {en ? "Preparing the map…" : "지도를 준비하고 있어요…"}
      </p>
    );
  }
  if (runState === "failed" || (data && data.missing) || (data && !data.run)) {
    return (
      <p className="ui-mapwalk-missing" data-no-i18n style={{ textAlign: "center", fontSize: 14 }}>
        {en ? "Couldn't find the saved run." : "저장된 살아 보기를 찾지 못했어요."}
      </p>
    );
  }
  if (!data || !segments.length) {
    return (
      <p className="ui-mapwalk-pending" data-no-i18n style={{ textAlign: "center", fontSize: 14 }}>
        {en ? "Preparing the map…" : "지도를 준비하고 있어요…"}
      </p>
    );
  }

  const W = box && box.w > 1 ? box.w : FALLBACK_W;
  const H = box && box.h > 1 ? box.h : FALLBACK_H;
  const allPts = [];
  for (const s of segments) for (const p of (s.pts || [])) allPts.push({ lon: p[0], lat: p[1] });
  for (const o of (tl.others || [])) {
    for (const s of (o.segments || [])) for (const p of (s.pts || [])) allPts.push({ lon: p[0], lat: p[1] });
  }
  // Follow keeps the moving dot centred at the current zoom: the same
  // lon/lat span as the whole day, re-centred on the dot.
  let fitPts = allPts;
  if (follow && pos) {
    const lons = allPts.map((p) => p.lon);
    const lats = allPts.map((p) => p.lat);
    const spanLon = Math.max(Math.max(...lons) - Math.min(...lons), 1e-6);
    const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 1e-6);
    fitPts = [
      { lon: pos.lon - spanLon / 2, lat: pos.lat - spanLat / 2 },
      { lon: pos.lon + spanLon / 2, lat: pos.lat + spanLat / 2 },
    ];
  }
  // 38c4: 28 px on every side keeps the home pin, the work
  // square and the station pills inside the frame.
  const fit = fitMapView(fitPts, W, H, undefined,
    { top: 28, right: 28, bottom: 28, left: 28 });
  const toXY = (lon, lat) => fit.toXY(lon, lat);
  const apiBase = basemapApiBase();
  const [cx, cy] = fit.toLonLat(W / 2, H / 2);
  const provider = basemapProvider(cx, cy);
  const tiles = (provider === "vworld" && apiBase === null) ? []
    : basemapTiles({ toLonLat: fit.toLonLat, W, H,
      lat: fit.midLat, metersPerPx: fit.metersPerPx, provider });
  const tileKeys = new Set(tiles.map((t) => t.key));
  const underlay = (provider === "vworld" && apiBase !== null && tiles.length > 0)
    ? basemapUnderlayTiles({ toLonLat: fit.toLonLat, W, H,
      z: tiles[0].z, provider }).filter((t) => !tileKeys.has(t.key))
    : [];

  const homeCoord = (data.homeEntry && Number.isFinite(data.homeEntry.lon)
    && Number.isFinite(data.homeEntry.lat))
    ? [data.homeEntry.lon, data.homeEntry.lat]
    : (segments[0] && segments[0].pts[0]);
  const [hx, hy] = homeCoord ? toXY(homeCoord[0], homeCoord[1]) : [null, null];

  const credit = provider === "usgs"
    ? "Map: USGS The National Map"
    : (en
      ? "Map © MOLIT Spatial Information Open Platform (VWorld) · © OpenStreetMap contributors"
      : "지도 © 국토교통부 공간정보 오픈플랫폼(VWorld) · © OpenStreetMap contributors");
  const dayLabel = en ? `Day ${day}` : `${day}일차`;
  const playLabel = playing ? (en ? "Pause" : "일시정지") : (en ? "Play" : "재생");
  // 38c4: one pill per boarding / transfer / alighting station.
  const coordOfStation = (name) => {
    try {
      const s = data.network ? findStop(data.network, name) : null;
      return s ? [s.lon, s.lat] : null;
    } catch {
      return null;
    }
  };
  const pillNames = stationLabelsFor(segments);
  const pillTexts = en ? stationLabelsFor(segments, "en") : pillNames;
  const measurePill = (text) => ({ w: 18 + String(text || "").length * 14, h: 24 });
  const pinObstacles = [];
  if (hx != null && hy != null) pinObstacles.push({ x: hx - 14, y: hy - 14, w: 28, h: 28 });
  const workSeg = segments.find((s) => s && s.kind === "stay" && s.awayKind === "work" && s.pts && s.pts[0]);
  if (workSeg) {
    const [wx, wy] = toXY(workSeg.pts[0][0], workSeg.pts[0][1]);
    pinObstacles.push({ x: wx - 14, y: wy - 14, w: 28, h: 28 });
  }
  if (pos) {
    const [ox, oy] = toXY(pos.lon, pos.lat);
    pinObstacles.push({ x: ox - 14, y: oy - 14, w: 28, h: 28 });
  }
  const placedPills = placeLabels(
    pillNames.map((name, i) => {
      const c = coordOfStation(name);
      if (!c) return null;
      const [x, y] = toXY(c[0], c[1]);
      return { name, text: pillTexts[i], x, y };
    }).filter(Boolean),
    measurePill,
    pinObstacles,
  ).map((p) => ({
    ...p,
    x: Math.min(Math.max(p.x, 1), Math.max(1, W - p.w - 1)),
    y: Math.min(Math.max(p.y, 1), Math.max(1, H - p.h - 1)),
  }));

  return (
    <div className="ui-mapwalk" style={{ width: "100%", maxWidth: "100%", fontSize: 14 }}>
      <div ref={wrapRef} className="ui-mapwalk-map">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img"
        aria-label={en ? "Daily route map" : "하루 동선 지도"}
        style={{ display: "block", width: "100%", height: "100%" }}>
        <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" />
        {underlay.map((t) => {
          const [x0, y0] = toXY(t.nw[0], t.nw[1]);
          const [x1, y1] = toXY(t.se[0], t.se[1]);
          return (
            <image key={`under/${t.key}`} href={basemapTileUrl(apiBase, t.z, t.y, t.x, { provider })}
              x={Math.min(x0, x1)} y={Math.min(y0, y1)}
              width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)}
              preserveAspectRatio="none" pointerEvents="none" />
          );
        })}
        {tiles.map((t) => {
          const [x0, y0] = toXY(t.nw[0], t.nw[1]);
          const [x1, y1] = toXY(t.se[0], t.se[1]);
          return (
            <image key={t.key} href={basemapTileUrl(apiBase, t.z, t.y, t.x, { provider })}
              x={Math.min(x0, x1)} y={Math.min(y0, y1)}
              width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)}
              preserveAspectRatio="none" pointerEvents="none" />
          );
        })}
        {(tl.others || []).map((o) => {
          return (o.segments || []).map((s, i) => {
            return (
              <polyline key={`${o.agent}-${i}`} points={ptsAttr(s.pts || [], toXY)}
                fill="none" stroke="#9ca3af" strokeWidth={1.5} />
            );
          });
        })}
        {segments.map((s, i) => {
          if (s.kind === "ride") {
            return (
              <polyline key={i} points={ptsAttr(s.pts || [], toXY)}
                fill="none" stroke={lineColorFor({ id: s.line })} strokeWidth={3} />
            );
          }
          if (s.kind === "walk") {
            return (
              <polyline key={i} points={ptsAttr(s.pts || [], toXY)}
                fill="none" stroke="#1f2937" strokeWidth={3} strokeLinejoin="round" />
            );
          }
          if (!s.pts || !s.pts[0]) return null;
          const [sx, sy] = toXY(s.pts[0][0], s.pts[0][1]);
          return <StayMark key={i} seg={s} x={sx} y={sy} homeCoord={homeCoord} />;
        })}
        {homeCoord && hx != null && (
          <g>
            <circle cx={hx} cy={hy} r={10} fill="#2563eb" stroke="#fff" strokeWidth={2} />
            <text x={hx} y={hy + 5} textAnchor="middle" fontSize={14}
              fill="#fff" fontWeight={700}>{data.homeLabel}</text>
          </g>
        )}
        {pos && (() => {
          const [dx, dy] = toXY(pos.lon, pos.lat);
          return <circle cx={dx} cy={dy} r={6} fill="#e11d48" stroke="#fff" strokeWidth={2} />;
        })()}
        {placedPills.map((p) => (
          <g key={p.name}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.h / 2}
              fill="#fff" stroke="#94a3b8" strokeWidth={1} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 5} textAnchor="middle"
              fontSize={14} fill="#0f172a">{p.text}</text>
          </g>
        ))}
      </svg>
      </div>
      <div className="ui-mapwalk-foot">
      <p data-no-i18n style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>{credit}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
        maxWidth: "100%", flexWrap: "wrap" }}>
        <Button size="sm" label={`${playing ? "❚❚" : "▶"} ${playLabel}`}
          aria-label={playLabel} onClick={() => setPlaying((p) => !p)} />
        <input type="range" min={t0} max={t1} step={1} value={effMinute} style={{ flex: "1 1 160px", minWidth: 120, maxWidth: "100%" }}
          aria-label={en ? "Time of day" : "시간"}
          onChange={(e) => { setPlaying(false); setMinute(Number(e.target.value)); }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 1 auto", maxWidth: "100%" }}>
          <Button size="sm" variant="ghost" label="‹"
            aria-label={en ? "Previous day" : "이전 날"}
            isDisabled={day <= 1}
            onClick={() => { setDay((d) => Math.max(1, d - 1)); setMinute(null); setPlaying(false); }} />
          <span data-no-i18n style={{ fontSize: 14, flex: "0 0 auto" }}>{dayLabel}</span>
          <Button size="sm" variant="ghost" label="›"
            aria-label={en ? "Next day" : "다음 날"}
            isDisabled={day >= days}
            onClick={() => { setDay((d) => Math.min(days, d + 1)); setMinute(null); setPlaying(false); }} />
        </span>
        <Button size="sm" variant="secondary" label={en ? "Fit" : "전체"}
          aria-label={en ? "Fit whole day" : "전체 보기"}
          onClick={() => setFollow(false)} />
        <Button size="sm" variant={follow ? "primary" : "secondary"}
          label={en ? "Follow" : "따라가기"}
          aria-label={en ? "Follow the moving dot" : "따라가기"}
          aria-pressed={follow} onClick={() => setFollow((f) => !f)} />
      </div>
      <p data-no-i18n style={{ fontSize: 14, margin: "8px 0 0", whiteSpace: "normal", overflowWrap: "break-word" }}>
        {pos && pos.seg ? activityLine(pos.seg, effMinute, en ? "en" : "ko") : ""}
      </p>
      </div>
    </div>
  );
}
