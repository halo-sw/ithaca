// Stage 38c: follow the same 30-day run on a flat map instead of 3D.
// Parses the scene URL (custom/home/day), waits on runReady like
// SceneFrame, then draws that day's walk + ride segments over the
// VWorld white tiles with fitMapView. No keys, no stored geocoder.
import { useEffect, useMemo, useState } from "react";
import { loadCustomRun } from "../chat/idb.js";
import { loadBoxArea, NETWORK_URL } from "../chat/engine.js";
import { fetchDataJson } from "../data-fetch.js";
import { fitMapView, lineColorFor, findStop } from "../chatmap.js";
import { basemapApiBase, basemapTileUrl, basemapTiles,
  basemapUnderlayTiles, basemapProvider } from "../basemap.js";
import { dayTimeline, positionAt, activityLine } from "../mapwalk.js";

const W = 390;
const H = 300;

export function parseMapWalkUrl(url) {
  try {
    const q = String(url || "").split("?")[1] || "";
    const p = new URLSearchParams(q);
    return {
      custom: p.get("custom"),
      home: p.get("home") || "A",
      day: Number(p.get("day")) || 1,
      follow: Number(p.get("follow")) || 1,
    };
  } catch {
    return { custom: null, home: "A", day: 1, follow: 1 };
  }
}

function lineForLabel(network, label) {
  for (const ln of (network && network.lines) || []) {
    if (ln && (ln.name === label || ln.id === label)) return ln;
  }
  return null;
}

function ptsAttr(pts, toXY) {
  return pts.map(([lon, lat]) => {
    const [x, y] = toXY(lon, lat);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function MapWalk({ url, lang = "ko", phone = false, runReady }) {
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
  const [data, setData] = useState(null);
  const [minute, setMinute] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
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
  }, [runState, parsed.custom, parsed.home]);

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
    return dayTimeline(data.run, { day, agents, nodeCoordsFor, stationCoord, network: data.network });
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

  const allPts = [];
  for (const s of segments) for (const p of (s.pts || [])) allPts.push({ lon: p[0], lat: p[1] });
  for (const o of (tl.others || [])) {
    for (const s of (o.segments || [])) for (const p of (s.pts || [])) allPts.push({ lon: p[0], lat: p[1] });
  }
  const fit = fitMapView(allPts, W, H);
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

  return (
    <div className="ui-mapwalk" style={{ width: "100%", fontSize: 14 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={en ? "Daily route map" : "하루 동선 지도"}
        style={{ display: "block", width: "100%", height: "auto" }}>
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
                fill="none" stroke={lineColorFor(lineForLabel(data.network, s.label))} strokeWidth={3} />
            );
          }
          if (s.kind === "walk") {
            return (
              <polyline key={i} points={ptsAttr(s.pts || [], toXY)}
                fill="none" stroke="#1f2937" strokeWidth={3} strokeLinejoin="round" />
            );
          }
          const [sx, sy] = toXY(s.pts[0][0], s.pts[0][1]);
          return (
            <g key={i}>
              <rect x={sx - 6} y={sy - 6} width={12} height={12} fill="#111827" />
            </g>
          );
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
      </svg>
      <p data-no-i18n style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>{credit}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <button type="button" onClick={() => setPlaying((p) => !p)}
          aria-label={playLabel} style={{ fontSize: 14, flex: "0 0 auto" }}>
          {playing ? (en ? "❚❚" : "❚❚") : (en ? "▶" : "▶")} {playLabel}
        </button>
        <input type="range" min={t0} max={t1} step={1} value={effMinute} style={{ flex: "1 1 auto", minWidth: 0 }}
          aria-label={en ? "Time of day" : "시간"}
          onChange={(e) => { setPlaying(false); setMinute(Number(e.target.value)); }} />
        <button type="button" disabled={day <= 1} style={{ fontSize: 14, flex: "0 0 auto" }}
          aria-label={en ? "Previous day" : "이전 날"}
          onClick={() => { setDay((d) => Math.max(1, d - 1)); setMinute(null); setPlaying(false); }}>
          {"‹"}
        </button>
        <span data-no-i18n style={{ fontSize: 14, flex: "0 0 auto" }}>{dayLabel}</span>
        <button type="button" disabled={day >= days} style={{ fontSize: 14, flex: "0 0 auto" }}
          aria-label={en ? "Next day" : "다음 날"}
          onClick={() => { setDay((d) => Math.min(days, d + 1)); setMinute(null); setPlaying(false); }}>
          {"›"}
        </button>
      </div>
      <p data-no-i18n style={{ fontSize: 14, margin: "8px 0 0" }}>
        {pos && pos.seg ? activityLine(pos.seg, effMinute, en ? "en" : "ko") : ""}
      </p>
    </div>
  );
}
