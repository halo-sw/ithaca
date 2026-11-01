"""Station scene boxes for stage 12a (up to 60, incremental, resumable).

Selection: every subway station inside the 9 search regions that has a
residential complex within 600 m becomes a 1.2 km ``bbox`` scene box
(same kind as 판교/성수/잠실). Counting runs on one region PBF extract
per region (clipped from the national PBF once, then reused for every
box in that region): a single pyosmium pass collects metro stations
and apartment buildings, and a station qualifies when at least one
apartment building (``building=apartments``, or ``building=residential``
with ``levels >= 4`` — the same split as
:func:`pipeline.building_join.classify_residential`) sits within 600 m.
Boxes are ordered by that count, capped at 60; stations below the cut
are logged as skipped.

Required stations hold guaranteed slots inside the cap of 60
(flagged ``required``; ``forced`` only when their count is 0 or they
are missing from OSM): 왕십리, 강남, 삼성, 천호, 고덕, 남위례, 모란,
정자, 서현, 미금, 수지구청, plus the existing box stations 판교,
성수, 잠실.

Box ids are ``st-<station>`` (e.g. ``st-판교``); the CLI pattern
``station:*`` selects all of them. Each box dir carries
``box_manifest.json`` with the input signature (station coords, box
bbox, source-extract identity, pipeline code version); a box whose
manifest matches is skipped unless ``--overwrite`` is passed, so
``pipeline build --areas station:*`` is incremental and resumable.

Outputs:

* ``data/build/station-boxes.json`` — the selected list (coords,
  region, counts, forced flags) plus the skipped list.
* ``data/build/boxes-report.json`` — per-box build seconds and bytes.
* ``data/build/areas-index.json`` — every built area (legacy + boxes):
  id, label, center, bbox, station, size. The app reads this file,
  never a hard-coded array.
"""

from __future__ import annotations

import json
import math
import subprocess
import time
from pathlib import Path

import osmium

from .areas import BOX_HALF_M, METERS_PER_DEG_LAT, bbox_from_center

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW_PBF = REPO_ROOT / "data" / "raw" / "south-korea-latest.osm.pbf"
DEFAULT_BUILD_DIR = REPO_ROOT / "data" / "build"

STATION_BOX_PREFIX = "st-"
BOXES_FILE = "station-boxes.json"
BOXES_REPORT_FILE = "boxes-report.json"
AREAS_INDEX_FILE = "areas-index.json"
BOX_MANIFEST_FILE = "box_manifest.json"
REGION_EXTRACT_DIR = "_cache/regions"

# Code version: bump when the box pipeline changes enough to rebuild.
BOX_CODE_VERSION = "12a.1"

MAX_BOXES = 200

MIN_HOME_BOX_HOMES = 8
MAX_HOME_BOXES = 80
COUNT_RADIUS_M = 600.0

# Always included (brief §A.2), plus the three existing box stations.
REQUIRED_STATIONS = ("왕십리", "강남", "삼성", "천호", "고덕", "남위례",
                     "모란", "정자", "서현", "미금", "수지구청",
                     "판교", "성수", "잠실")

RAILWAY_STATION_TAGS = ("station", "subway_station", "halt")


def is_station_box(area_id: str) -> bool:
    return area_id.startswith(STATION_BOX_PREFIX)


def station_of(area_id: str) -> str:
    return area_id[len(STATION_BOX_PREFIX):]


def box_id_of(station: str) -> str:
    return f"{STATION_BOX_PREFIX}{station}"


def _is_metro_station(tags: dict) -> bool:
    from .areas import _is_metro_station as impl

    return impl(tags)


def _is_caltrain_station(tags: dict) -> bool:
    from .areas import _is_caltrain_station as impl

    return impl(tags)


def _is_trunk_station(tags: dict) -> bool:
    """Metro or Caltrain station: either can centre a scene box."""
    return _is_metro_station(tags) or _is_caltrain_station(tags)


def _norm_station(name: str) -> str:
    return (name or "").strip().removesuffix("역").strip()


PLACE_VALUES = ("quarter", "neighbourhood", "suburb")


class _RegionScan(osmium.SimpleHandler):
    """Collect metro stations + apartment buildings from a region extract."""

    def __init__(self):
        super().__init__()
        self.stations: list[dict] = []
        self.apartments: list[tuple[float, float]] = []
        self.places: list[dict] = []

    def _station_hit(self, kind: str, obj, lon: float, lat: float):
        tags = dict(obj.tags)
        if tags.get("railway") not in RAILWAY_STATION_TAGS:
            return
        if not tags.get("name"):
            return
        self.stations.append({"kind": kind, "id": obj.id, "tags": tags,
                             "lon": lon, "lat": lat})

    def node(self, n):
        if not n.location.valid():
            return
        tags = dict(n.tags)
        if tags.get("railway") in RAILWAY_STATION_TAGS and tags.get("name"):
            self._station_hit("node", n, n.location.lon, n.location.lat)
            return
        if tags.get("place") in PLACE_VALUES and tags.get("name"):
            self.places.append({"name": tags["name"],
                                "lon": n.location.lon, "lat": n.location.lat})
            return
        if _is_apartment_tags(tags):
            self.apartments.append((n.location.lon, n.location.lat))

    def way(self, w):
        tags = dict(w.tags)
        coords = [(nd.lon, nd.lat) for nd in w.nodes
                  if nd.location.valid()]
        if not coords:
            return
        if tags.get("railway") in RAILWAY_STATION_TAGS and tags.get("name"):
            xs = [c[0] for c in coords]
            ys = [c[1] for c in coords]
            self._station_hit("way", w, sum(xs) / len(xs), sum(ys) / len(ys))
        elif _is_apartment_tags(tags):
            xs = [c[0] for c in coords]
            ys = [c[1] for c in coords]
            self.apartments.append((sum(xs) / len(xs), sum(ys) / len(ys)))


def _is_apartment_tags(tags: dict) -> bool:
    if tags.get("building") == "apartments":
        return True
    if tags.get("building") == "residential":
        try:
            return int(float(tags.get("building:levels", "0"))) >= 4
        except (TypeError, ValueError):
            return False
    return False


def scan_region_extract(region_pbf: str | Path) -> dict:
    """One pyosmium pass: stations + apartment centroids + place nodes."""
    handler = _RegionScan()
    handler.apply_file(str(region_pbf), locations=True)
    return {"stations": handler.stations, "apartments": handler.apartments,
            "places": handler.places}


def _local_xy(lon: float, lat: float, lon0: float, lat0: float):
    kx = METERS_PER_DEG_LAT * math.cos(math.radians(lat0))
    return ((lon - lon0) * kx, (lat - lat0) * METERS_PER_DEG_LAT)


def count_nearby(apartments: list[tuple[float, float]],
                 lon: float, lat: float,
                 radius_m: float = COUNT_RADIUS_M) -> int:
    """Apartment buildings within ``radius_m`` of (lon, lat)."""
    x0, y0 = _local_xy(lon, lat, lon, lat)
    n = 0
    for alon, alat in apartments:
        x, y = _local_xy(alon, alat, lon, lat)
        if math.hypot(x - x0, y - y0) <= radius_m:
            n += 1
    return n


def dedupe_stations(stations: list[dict]) -> list[dict]:
    """One row per normalised station name (metro node wins, like areas)."""
    by_name: dict[str, list[dict]] = {}
    for s in stations:
        by_name.setdefault(_norm_station(s["tags"]["name"]), []).append(s)

    def rank(s):
        trunk = 0 if _is_trunk_station(s["tags"]) else 1
        kind = {"node": 0, "way": 1}.get(s["kind"], 2)
        return (trunk, kind, s["id"])

    return [sorted(group, key=rank)[0]
            for group in sorted(by_name.values(), key=lambda g: g[0]["id"])]


def select_boxes(scanned: dict[str, dict],
                 max_boxes: int = MAX_BOXES) -> dict:
    """Order stations by apartment count, cap, force required ones.

    ``scanned`` maps region id -> scan_region_extract() output (plus the
    region label under ``_label``). Returns ``{"boxes", "skipped"}``;
    boxes carry lon/lat, region, count, forced.
    """
    seen: dict[str, dict] = {}
    for region_id, scan in scanned.items():
        label = scan.get("_label", region_id)
        for hit in dedupe_stations(scan["stations"]):
            name = _norm_station(hit["tags"]["name"])
            count = count_nearby(scan["apartments"], hit["lon"], hit["lat"])
            row = {"station": name, "lon": hit["lon"], "lat": hit["lat"],
                   "region": region_id, "region_label": label,
                   "count": count, "osm_kind": hit["kind"],
                   "osm_id": hit["id"]}
            prev = seen.get(name)
            if prev is None or count > prev["count"]:
                seen[name] = row
    qualified = [r for r in seen.values() if r["count"] > 0]
    qualified.sort(key=lambda r: (-r["count"], r["station"]))
    required = set(REQUIRED_STATIONS)
    # Required stations hold guaranteed slots inside the cap; the rest
    # goes to the top counts. Missing-from-OSM required stations still
    # occupy a slot (flagged missing) so the gap is visible.
    boxes: list[dict] = []
    boxed: set[str] = set()
    for name in REQUIRED_STATIONS:
        row = seen.get(name)
        if row is None:
            boxes.append({"station": name, "lon": None, "lat": None,
                          "region": None, "region_label": None, "count": 0,
                          "osm_kind": None, "osm_id": None,
                          "required": True, "forced": True, "missing": True})
        else:
            boxes.append({**row, "required": True,
                          "forced": row["count"] == 0})
        boxed.add(name)
    for row in qualified:
        if len(boxes) >= max_boxes:
            break
        if row["station"] in boxed:
            continue
        boxes.append({**row, "required": False, "forced": False})
        boxed.add(row["station"])
    boxed_names = {b["station"] for b in boxes}
    skipped = sorted(
        ({"station": name, "region": row["region"], "count": row["count"],
          "reason": "no apartments within 600 m" if row["count"] == 0
          else f"below the top-{max_boxes} cut"}
         for name, row in seen.items() if name not in boxed_names),
        key=lambda r: (-r["count"], r["station"]))
    return {"boxes": boxes, "skipped": skipped,
            "required": list(REQUIRED_STATIONS)}


def ensure_region_extract(region_id: str, bbox: list[float],
                          raw_pbf: str | Path = DEFAULT_RAW_PBF,
                          build_dir: str | Path = DEFAULT_BUILD_DIR,
                          osmium_bin: str = "osmium",
                          overwrite: bool = False) -> Path:
    """Clip the national PBF to one region bbox, once (cached)."""
    from .extract import clip_bbox, find_osmium

    binary = find_osmium(osmium_bin)
    out = Path(build_dir) / REGION_EXTRACT_DIR / f"{region_id}.osm.pbf"
    if out.exists() and not overwrite:
        return out
    clip_bbox(binary, Path(raw_pbf), tuple(bbox), out)
    return out


def load_boxes(build_dir: str | Path = DEFAULT_BUILD_DIR) -> dict | None:
    path = Path(build_dir) / BOXES_FILE
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def box_coords(box: dict) -> tuple[float, float]:
    if box.get("lon") is None or box.get("lat") is None:
        raise LookupError(
            f"station {box.get('station')!r} has no OSM coordinates "
            "(missing from every region extract)")
    return (float(box["lon"]), float(box["lat"]))


# --- incremental manifests -------------------------------------------------

def manifest_signature(box: dict, source_extract: Path) -> dict:
    lon, lat = box_coords(box)
    st = source_extract.stat()
    return {"station": box.get("station", box.get("id")), "lon": lon, "lat": lat,
            "bbox": list(bbox_from_center(lon, lat)),
            "source_extract": source_extract.name,
            "source_mtime": int(st.st_mtime),
            "source_bytes": int(st.st_size),
            "code": BOX_CODE_VERSION}


def manifest_matches(area_dir: Path, sig: dict) -> bool:
    path = area_dir / BOX_MANIFEST_FILE
    if not path.exists():
        return False
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return False
    if saved.get("signature") != sig:
        return False
    for name in ("area.json", "report.json"):
        if not (area_dir / name).exists():
            return False
    return True


def write_manifest(area_dir: Path, sig: dict, extra: dict | None = None) -> Path:
    path = area_dir / BOX_MANIFEST_FILE
    doc = {"signature": sig}
    if extra:
        doc.update(extra)
    path.write_text(json.dumps(doc, indent=2, sort_keys=True,
                               ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def dir_size_bytes(path: Path) -> int:
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


# --- areas-index.json --------------------------------------------------------

def write_areas_index(build_dir: str | Path = DEFAULT_BUILD_DIR) -> dict:
    """Index every built area dir (legacy + station boxes) for the app."""
    build_dir = Path(build_dir)
    areas = []
    for area_def_path in sorted(build_dir.glob("*/area_def.json")):
        area_dir = area_def_path.parent
        try:
            area_def = json.loads(area_def_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        areas.append({
            "id": area_def.get("id", area_dir.name),
            "label": area_def.get("label", area_dir.name),
            "center": area_def.get("center"),
            "bbox": area_def.get("bbox"),
            "station": area_def.get("station"),
            "size_bytes": dir_size_bytes(area_dir),
        })
    areas.sort(key=lambda a: a["id"])
    doc = {"areas": areas,
           "note": "Built-scene index. The app fetches this file and loads only the selected box."}
    out = build_dir / AREAS_INDEX_FILE
    out.write_text(json.dumps(doc, indent=2, sort_keys=True,
                              ensure_ascii=False) + "\n", encoding="utf-8")
    return {"file": str(out), "count": len(areas)}


def update_boxes_report(build_dir: str | Path, entry: dict) -> dict:
    """Merge one per-box {seconds, bytes} entry into boxes-report.json."""
    path = Path(build_dir) / BOXES_REPORT_FILE
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        doc = {"boxes": {}}
    doc.setdefault("boxes", {})[entry["box"]] = {
        k: v for k, v in entry.items() if k != "box"}
    path.write_text(json.dumps(doc, indent=2, sort_keys=True,
                               ensure_ascii=False) + "\n", encoding="utf-8")
    return doc


def _station_bboxes(boxes: list[dict]) -> list:
    out = []
    for b in boxes:
        if b.get("lon") is None or b.get("lat") is None:
            continue
        out.append(bbox_from_center(float(b["lon"]), float(b["lat"])))
    return out


def _inside_bbox(lon: float, lat: float, bbox) -> bool:
    return bool(bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3])


def _place_name_for(lon: float, lat: float, region_id: str,
                    scanned: dict | None) -> str:
    places = []
    label = region_id
    if scanned and region_id in scanned:
        scan = scanned[region_id]
        places = scan.get("places", []) or []
        label = scan.get("_label", region_id)
    best, best_d = None, 1000.0
    for p in places:
        if not p.get("name"):
            continue
        dx, dy = _local_xy(float(p["lon"]), float(p["lat"]), lon, lat)
        import math as _math
        d = _math.hypot(dx, dy)
        if d <= 1000.0 and (best is None or d < best_d):
            best, best_d = p["name"], d
    if best:
        return best
    return str(label).split()[-1]


def select_home_boxes(homes: list[dict], boxes: list[dict],
                      scanned: dict | None = None,
                      max_boxes: int = MAX_HOME_BOXES,
                      min_homes: int = MIN_HOME_BOX_HOMES) -> list[dict]:
    """Greedy 1.2 km cover of homes outside every station box.

    Candidate centres are the uncovered home points; the centre whose
    box holds the most uncovered homes wins each round (ties: lower
    lon, then lat). Stops when the best box holds fewer than
    ``min_homes`` or after ``max_boxes`` picks.
    """
    station_bboxes = _station_bboxes(boxes or [])
    pts = []
    for h in homes or []:
        try:
            lon, lat = float(h["lon"]), float(h["lat"])
        except (KeyError, TypeError, ValueError):
            continue
        if any(_inside_bbox(lon, lat, b) for b in station_bboxes):
            continue
        pts.append({"lon": lon, "lat": lat,
                    "region": h.get("region")})
    uncovered = list(range(len(pts)))
    cell = 0.005
    picked: list[dict] = []
    per_region: dict[str, int] = {}
    while uncovered and len(picked) < max_boxes:
        grid: dict[tuple[int, int], list[int]] = {}
        for i in uncovered:
            p = pts[i]
            grid.setdefault((math.floor(p["lon"] / cell),
                             math.floor(p["lat"] / cell)), []).append(i)
        best_idx, best_members = None, []
        for i in sorted(uncovered, key=lambda j: (pts[j]["lon"], pts[j]["lat"])):
            p = pts[i]
            bbox = bbox_from_center(p["lon"], p["lat"])
            cx, cy = math.floor(p["lon"] / cell), math.floor(p["lat"] / cell)
            members = []
            for dx in (-2, -1, 0, 1, 2):
                for dy in (-2, -1, 0, 1, 2):
                    for j in grid.get((cx + dx, cy + dy), []):
                        q = pts[j]
                        if _inside_bbox(q["lon"], q["lat"], bbox):
                            members.append(j)
            if best_idx is None or len(members) > len(best_members):
                best_idx, best_members = i, members
        if best_idx is None or len(best_members) < min_homes:
            break
        c = pts[best_idx]
        region = c.get("region") or ""
        per_region[region] = per_region.get(region, 0) + 1
        name = _place_name_for(c["lon"], c["lat"], region, scanned)
        label_scan = (scanned or {}).get(region, {}).get("_label", region)
        picked.append({"id": f"hm-{region}-{per_region[region]:02d}",
                       "lon": c["lon"], "lat": c["lat"],
                       "region": region, "region_label": label_scan,
                       "homes": len(best_members),
                       "label": f"{name} 일대"})
        gone = set(best_members)
        uncovered = [j for j in uncovered if j not in gone]
    return picked


# --- discovery run -----------------------------------------------------------

def run_discovery(raw_pbf: str | Path = DEFAULT_RAW_PBF,
                  build_dir: str | Path = DEFAULT_BUILD_DIR,
                  regions_path: str | Path | None = None,
                  osmium_bin: str = "osmium",
                  overwrite: bool = False,
                  max_boxes: int = MAX_BOXES) -> dict:
    """Clip each region once, scan, select boxes, write station-boxes.json."""
    from .extract import find_osmium

    build_dir = Path(build_dir)
    binary = find_osmium(osmium_bin)
    regions_path = (Path(regions_path) if regions_path
                    else build_dir / "regions.json")
    doc = json.loads(regions_path.read_text(encoding="utf-8"))
    scanned: dict[str, dict] = {}
    for region in doc["regions"]:
        if region.get("country") == "US" or str(region.get("id", "")).startswith("us-"):
            continue
        bbox = region.get("bbox")
        if not bbox:
            continue
        extract = ensure_region_extract(
            region["id"], bbox, raw_pbf, build_dir,
            osmium_bin=binary, overwrite=overwrite)
        scan = scan_region_extract(extract)
        scan["_label"] = region["label"]
        scanned[region["id"]] = scan
    selected = select_boxes(scanned, max_boxes=max_boxes)
    homes_path = build_dir / "homes-index.json"
    homes_rows: list[dict] = []
    if homes_path.exists():
        try:
            homes_rows = json.loads(homes_path.read_text(encoding="utf-8")).get("homes", [])
        except (json.JSONDecodeError, OSError):
            homes_rows = []
    home_boxes = select_home_boxes(homes_rows, selected["boxes"], scanned)
    selected["home_boxes"] = home_boxes
    selected["summary"] = {"home_boxes": len(home_boxes)}
    out = build_dir / BOXES_FILE
    station_bboxes = _station_bboxes(selected["boxes"])
    home_bboxes = [bbox_from_center(float(b["lon"]), float(b["lat"]))
                   for b in home_boxes]
    uncovered_after = 0
    for h in homes_rows:
        try:
            lon, lat = float(h["lon"]), float(h["lat"])
        except (KeyError, TypeError, ValueError):
            continue
        if any(_inside_bbox(lon, lat, b) for b in station_bboxes):
            continue
        if any(_inside_bbox(lon, lat, b) for b in home_bboxes):
            continue
        uncovered_after += 1
    selected["summary"]["homes_uncovered_after"] = uncovered_after
    out.write_text(json.dumps(selected, indent=2, sort_keys=True,
                               ensure_ascii=False) + "\n", encoding="utf-8")
    return {"file": str(out),
            "regions_scanned": sorted(scanned),
            "boxes": len(selected["boxes"]),
            "skipped": len(selected["skipped"]),
            "forced": sorted(b["station"] for b in selected["boxes"]
                             if b.get("forced")),
            "home_boxes": len(home_boxes),
            "homes_uncovered_after": uncovered_after}
