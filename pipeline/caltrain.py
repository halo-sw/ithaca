"""Caltrain network from GTFS (Stage 29N1)."""

from __future__ import annotations

import csv
import json
import statistics
import zipfile
from pathlib import Path

LINE_ID = "caltrain"
LINE_NAME = "Caltrain"


def _read_csv(zf: zipfile.ZipFile, name: str) -> list[dict]:
    with zf.open(name) as fh:
        text = fh.read().decode("utf-8-sig")
    return list(csv.DictReader(text.splitlines()))


def load_gtfs(zip_path: str | Path) -> dict:
    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())
        stops = _read_csv(zf, "stops.txt")
        trips = _read_csv(zf, "trips.txt")
        stop_times = _read_csv(zf, "stop_times.txt")
        calendar = _read_csv(zf, "calendar.txt") if "calendar.txt" in names else []
        calendar_dates = _read_csv(zf, "calendar_dates.txt") if "calendar_dates.txt" in names else []
    return {"stops": stops, "trips": trips, "stop_times": stop_times,
            "calendar": calendar, "calendar_dates": calendar_dates}


def parent_stations(stops: list[dict]) -> dict[str, dict]:
    """GTFS parent stations (location_type=1), keyed by stop_id."""
    out = {}
    for s in stops:
        if (s.get("location_type") or "").strip() == "1":
            out[(s.get("stop_id") or "").strip()] = s
    if not out:
        # Fallback: stops that are parents of other stops.
        child_parents = { (r.get("parent_station") or "").strip()
                          for r in stops if (r.get("parent_station") or "").strip() }
        for s in stops:
            if (s.get("stop_id") or "").strip() in child_parents:
                out[(s.get("stop_id") or "").strip()] = s
    return out


def station_id_for_stop(stop_id: str, stops_by_id: dict, parents: dict) -> str | None:
    s = stops_by_id.get(stop_id)
    if s is None:
        return None
    if stop_id in parents:
        return stop_id
    parent = (s.get("parent_station") or "").strip()
    if parent and parent in parents:
        return parent
    return None


def weekday_service_ids(calendar: list[dict]) -> set[str]:
    out = set()
    for row in calendar:
        if (row.get("monday") or "").strip() == "1":
            out.add((row.get("service_id") or "").strip())
    return out


def clean_name(name: str) -> str:
    n = (name or "").strip()
    for suffix in (" Caltrain Station", " Caltrain", " Station"):
        if n.endswith(suffix):
            n = n[: -len(suffix)].strip()
    return n


def build_caltrain(gtfs_zip: str | Path, out_build_dir: str | Path,
                   out_scenarios_dir: str | Path):
    """Build network.json, caltrain-interstation.csv, caltrain-am.json."""
    from .homes import haversine_m

    data = load_gtfs(gtfs_zip)
    stops_by_id = {(s.get("stop_id") or "").strip(): s for s in data["stops"]}
    parents = parent_stations(data["stops"])
    trip_service = {(t.get("trip_id") or "").strip(): (t.get("service_id") or "").strip()
                    for t in data["trips"]}
    trip_headsign = {(t.get("trip_id") or "").strip(): (t.get("trip_headsign") or "")
                     for t in data["trips"]}
    weekday = weekday_service_ids(data["calendar"])

    # stop_times grouped by trip, sorted by stop_sequence
    by_trip: dict[str, list[dict]] = {}
    for r in data["stop_times"]:
        by_trip.setdefault((r.get("trip_id") or "").strip(), []).append(r)
    for rows in by_trip.values():
        rows.sort(key=lambda r: int(r.get("stop_sequence") or 0))

    def to_min(t: str | None) -> int | None:
        if not t:
            return None
        parts = t.strip().split(":")
        if len(parts) < 2:
            return None
        try:
            h, m = int(parts[0]), int(parts[1])
        except ValueError:
            return None
        return h * 60 + m

    def dep_min(row: dict) -> int | None:
        return to_min(row.get("departure_time") or row.get("arrival_time"))

    # Station order: SF -> San Jose = descending latitude.
    ordered = sorted(parents.values(),
                     key=lambda s: float(s.get("stop_lat") or 0.0), reverse=True)
    coords = { (s.get("stop_id") or "").strip():
               (float(s.get("stop_lon") or 0.0), float(s.get("stop_lat") or 0.0))
               for s in ordered }
    chain = {}
    acc = 0.0
    prev = None
    for s in ordered:
        sid = (s.get("stop_id") or "").strip()
        if prev is not None:
            acc += haversine_m(coords[prev][0], coords[prev][1],
                               coords[sid][0], coords[sid][1]) / 1000.0
        chain[sid] = acc
        prev = sid

    stops = [{"id": f"{LINE_ID}:{(s.get('stop_id') or '').strip()}",
                "key": clean_name(s.get("stop_name") or ""),
                "name": clean_name(s.get("stop_name") or ""),
                "lon": coords[(s.get("stop_id") or "").strip()][0],
                "lat": coords[(s.get("stop_id") or "").strip()][1]}
               for s in ordered]
    stop_ids = [s["id"] for s in stops]
    chainages = [round(chain[(s.get("stop_id") or "").strip()], 3)
                 for s in ordered]
    network = {"lines": [{
        "id": LINE_ID, "name": LINE_NAME, "circle": False,
        "stops": stops,
        "patterns": [{
            "id": f"{LINE_ID}:southbound",
            "name": "Southbound (SF → San Jose)",
            "direction": "down",
            "stops": stop_ids,
            "chainage_km": chainages,
            "distance_km": chainages[-1] if chainages else 0.0,
            "distance_method": "haversine",
        }],
    }],
        "transfers": [],
        "meta": {"source": "Caltrain GTFS (2026-06)",
                 "lines": [LINE_ID],
                 "note": "Inter-station times use the local/all-stop "
                         "pattern; express trains skip stations."}}
    stations = [{"id": (s.get("stop_id") or "").strip(),
                 "name": clean_name(s.get("stop_name") or "")}
                for s in ordered]
    out_build = Path(out_build_dir)
    out_build.mkdir(parents=True, exist_ok=True)
    (out_build / "network.json").write_text(
        json.dumps(network, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    order_idx = {s["id"]: i for i, s in enumerate(stations)}
    menlo_id = next((s["id"] for s in stations if s["name"] == "Menlo Park"), None)

    # Weekday AM trips 07:00-09:30 that stop at both stations (per segment).
    seg_times: dict[tuple[str, str], list[float]] = {}
    for tid, rows in by_trip.items():
        if trip_service.get(tid) not in weekday:
            continue
        # Map station -> departure minute for this trip.
        station_dep: dict[str, int] = {}
        for r in rows:
            sid = station_id_for_stop((r.get("stop_id") or "").strip(),
                                      stops_by_id, parents)
            if sid is None:
                continue
            dm = dep_min(r)
            if dm is None:
                continue
            if sid not in station_dep and 420 <= dm <= 570:
                station_dep[sid] = dm
        for a, b in zip([s["id"] for s in stations], [s["id"] for s in stations][1:]):
            if a in station_dep and b in station_dep:
                seg_times.setdefault((a, b), []).append(
                    abs(station_dep[b] - station_dep[a]))

    seg_pairs = list(zip([s["id"] for s in stations],
                         [s["id"] for s in stations][1:]))
    seg_dists = [round(chain[b] - chain[a], 3) for a, b in seg_pairs]
    seg_meds: list[int | None] = [
        round(statistics.median(seg_times[(a, b)]))
        if seg_times.get((a, b)) else None for a, b in seg_pairs]

    def _interp_rate(idx: int) -> float | None:
        before = next((seg_meds[j] / seg_dists[j]
                       for j in range(idx - 1, -1, -1)
                       if seg_meds[j] is not None and seg_dists[j] > 0),
                      None)
        after = next((seg_meds[k] / seg_dists[k]
                      for k in range(idx + 1, len(seg_pairs))
                      if seg_meds[k] is not None and seg_dists[k] > 0),
                     None)
        if before is not None and after is not None:
            j = next(j for j in range(idx - 1, -1, -1)
                     if seg_meds[j] is not None and seg_dists[j] > 0)
            k = next(k for k in range(idx + 1, len(seg_pairs))
                     if seg_meds[k] is not None and seg_dists[k] > 0)
            span = seg_dists[j] + seg_dists[k]
            if span > 0:
                return (seg_meds[j] + seg_meds[k]) / span
            return None
        return before if before is not None else after

    interpolated: list[str] = []
    rows_csv = []
    cum = 0.0
    for i, ((a, b), dist) in enumerate(zip(seg_pairs, seg_dists)):
        med = seg_meds[i]
        if med is None:
            rate = _interp_rate(i)
            if rate is not None and dist > 0:
                med = max(1, round(rate * dist))
        cum = round(cum + dist, 3)
        name = next(s["name"] for s in stations if s["id"] == b)
        if seg_meds[i] is None and med is not None:
            interpolated.append(name)
        rows_csv.append({"연번": str(i + 1), "호선": LINE_NAME,
                         "역명": name,
                         "소요시간": f"{med:02d}:00" if med is not None else "",
                         "역간거리(km)": str(dist),
                         "호선별누계(km)": str(cum)})
    out_scen = Path(out_scenarios_dir)
    out_scen.mkdir(parents=True, exist_ok=True)
    with open(out_scen / "caltrain-interstation.csv", "w", newline="",
              encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["연번", "호선", "역명", "소요시간",
                                           "역간거리(km)", "호선별누계(km)"])
        w.writeheader()
        w.writerows(rows_csv)

    # AM file: per station, ride minutes to Menlo Park + headway.
    am: dict = {"stations": [], "meta": {**network["meta"],
                                         "interpolated": interpolated}}
    if menlo_id is not None:
        for s in stations:
            sid = s["id"]
            if sid == menlo_id:
                continue
            rides: list[float] = []
            deps: list[int] = []
            for tid, rows in by_trip.items():
                if trip_service.get(tid) not in weekday:
                    continue
                station_dep = {}
                for r in rows:
                    psid = station_id_for_stop((r.get("stop_id") or "").strip(),
                                               stops_by_id, parents)
                    if psid is None:
                        continue
                    dm = dep_min(r)
                    if dm is None or not (420 <= dm <= 570):
                        continue
                    if psid not in station_dep:
                        station_dep[psid] = dm
                if sid not in station_dep or menlo_id not in station_dep:
                    continue
                # Direction check: must pass through intermediate stations.
                lo, hi = sorted((order_idx[sid], order_idx[menlo_id]))
                seq = [station_id_for_stop((r.get("stop_id") or "").strip(),
                                           stops_by_id, parents) for r in rows]
                seq = [x for x in seq if x is not None]
                try:
                    i0 = seq.index(sid)
                    i1 = seq.index(menlo_id)
                except ValueError:
                    continue
                if (i1 > i0) != (order_idx[menlo_id] > order_idx[sid]):
                    continue
                rides.append(abs(station_dep[menlo_id] - station_dep[sid]))
                deps.append(station_dep[sid])
            deps.sort()
            gaps = [b - a for a, b in zip(deps, deps[1:]) if b - a > 0]
            am["stations"].append({
                "station": s["name"],
                "ride_min_to_menlo_park": round(statistics.median(rides)) if rides else None,
                "headway_min": round(statistics.median(gaps)) if gaps else None,
                "source": "caltrain_gtfs"})
    (out_build / "caltrain-am.json").write_text(
        json.dumps(am, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"network": str(out_build / "network.json"),
            "csv": str(out_scen / "caltrain-interstation.csv"),
            "am": str(out_build / "caltrain-am.json")}


def run(gtfs_zip: str | Path = "data/raw/us/caltrain/caltrain-ca-us.zip",
        build_dir: str | Path = "data/build/region-us",
        scenarios_dir: str | Path = "scenarios/transit") -> dict:
    return build_caltrain(gtfs_zip, build_dir, scenarios_dir)
