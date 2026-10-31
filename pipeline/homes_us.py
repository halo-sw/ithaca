"""US homes: OSM apartment buildings + Zillow ZORI rent by ZIP.

Stage 26b. Builds ``data/build/homes/us-menlo.json`` in the same slim
shape as the Korean per-region files (so the web reads it), with the
rent in USD (``currency: "USD"``; the ``median_won`` key name is kept
for schema reuse).
"""

from __future__ import annotations

import csv
import heapq
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

from .areas import DEFAULT_BUILD_DIR
from .homes import (DEFAULT_RAW_DIR, STATION_CATEGORIES, WALK_MPS,
                    haversine_m, nearest_station_walk)

AREA_ID = "us-menlo"
ZORI_CSV = Path("us") / "zillow" / "Zip_zori_uc_sfrcondomfr_sm_month.csv"
ZORI_URL = "https://www.zillow.com/research/data/"
ZORI_LABEL = "Zillow ZORI (typical rent for this ZIP, all home types)"

CANDIDATE_BUILDINGS = {"apartments", "residential", "dormitory"}
NO_NAME_RE = re.compile(r"^Building\s+\S+$", re.IGNORECASE)
ZIP_RE = re.compile(r"^(\d{5})")
MONTH_COL_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ROAD_HIGHWAYS = {"residential", "tertiary", "secondary", "primary",
                 "living_street", "unclassified"}

BIKE_MPS = 15 / 3.6  # assumed bike speed


def load_zori(csv_path: str | Path) -> dict[str, dict]:
    """ZIP -> {"monthly_usd", "month"} from the latest non-empty month."""
    zori: dict[str, dict] = {}
    with open(csv_path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        months = [c for c in (reader.fieldnames or [])
                  if MONTH_COL_RE.match(c or "")]
        for row in reader:
            name = (row.get("RegionName") or "").strip()
            m = ZIP_RE.match(name)
            if not m:
                continue
            best = None
            for col in months:
                cell = (row.get(col) or "").strip()
                if not cell:
                    continue
                try:
                    val = float(cell)
                except ValueError:
                    continue
                best = (round(val), col[:7])
            if best is None:
                continue
            zori[m.group(1)] = {"monthly_usd": best[0], "month": best[1]}
    return zori


def address_points(pbf_path: str | Path) -> dict:
    """Scan once for postcode points and OSM address points.

    Returns ``{"postcodes": [(lon, lat, zip)],
    "addresses": [(lon, lat, housenumber, street)]}``.  An address is
    any node/way/relation with both ``addr:housenumber`` and
    ``addr:street``; ways use the centroid, as with postcodes.
    """
    import osmium

    class _Scan(osmium.SimpleHandler):
        def __init__(self) -> None:
            super().__init__()
            self.points: list[tuple[float, float, str]] = []
            self.addresses: list[tuple[float, float, str, str]] = []
            self._nodes: dict[int, tuple[float, float]] = {}
            self._ways: dict[int, tuple[float, float]] = {}

        @staticmethod
        def _zip(tags) -> str | None:
            try:
                raw = tags.get("addr:postcode") or ""
            except (AttributeError, LookupError):
                return None
            m = ZIP_RE.match(str(raw).strip())
            return m.group(1) if m else None

        @staticmethod
        def _addr(tags) -> tuple[str, str] | None:
            try:
                house = tags.get("addr:housenumber") or ""
                street = tags.get("addr:street") or ""
            except (AttributeError, LookupError):
                return None
            house, street = str(house).strip(), str(street).strip()
            if not house or not street:
                return None
            return house, street

        def node(self, n) -> None:
            if n.location.valid():
                xy = (n.location.lon, n.location.lat)
                self._nodes[n.id] = xy
                z = self._zip(n.tags)
                if z:
                    self.points.append((xy[0], xy[1], z))
                a = self._addr(n.tags)
                if a:
                    self.addresses.append((xy[0], xy[1], a[0], a[1]))

        def way(self, w) -> None:
            try:
                coords = [(nd.lon, nd.lat) for nd in w.nodes
                          if nd.location.valid()]
            except (AttributeError, RuntimeError):
                coords = []
            if not coords:
                return
            xy = (sum(c[0] for c in coords) / len(coords),
                  sum(c[1] for c in coords) / len(coords))
            self._ways[w.id] = xy
            z = self._zip(w.tags)
            if z:
                self.points.append((xy[0], xy[1], z))
            a = self._addr(w.tags)
            if a:
                self.addresses.append((xy[0], xy[1], a[0], a[1]))

        def relation(self, r) -> None:
            z = self._zip(r.tags)
            a = self._addr(r.tags)
            if not z and not a:
                return
            xs, ys = [], []
            try:
                members = list(r.members)
            except (AttributeError, RuntimeError):
                return
            for m in members:
                if m.type == "n" and m.ref in self._nodes:
                    xs.append(self._nodes[m.ref][0])
                    ys.append(self._nodes[m.ref][1])
                elif m.type == "w" and m.ref in self._ways:
                    xs.append(self._ways[m.ref][0])
                    ys.append(self._ways[m.ref][1])
            if not xs:
                return
            xy = (sum(xs) / len(xs), sum(ys) / len(ys))
            if z:
                self.points.append((xy[0], xy[1], z))
            if a:
                self.addresses.append((xy[0], xy[1], a[0], a[1]))

    scan = _Scan()
    scan.apply_file(str(pbf_path), locations=True)
    return {"postcodes": scan.points, "addresses": scan.addresses}


def postcode_points(pbf_path: str | Path) -> list[tuple[float, float, str]]:
    """Every node/way/relation in the extract with an ``addr:postcode``."""
    return address_points(pbf_path)["postcodes"]


def _point_in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    n = len(ring)
    if n < 3:
        return False
    x, y = lon, lat
    j = n - 1
    for i in range(n):
        try:
            xi, yi = float(ring[i][0]), float(ring[i][1])
            xj, yj = float(ring[j][0]), float(ring[j][1])
        except (IndexError, TypeError, ValueError):
            j = i
            continue
        if ((yi > y) != (yj > y)) and (
                x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _as_ring_list(ring) -> list | None:
    if ring is None:
        return None
    if isinstance(ring, dict):
        coords = ring.get("coordinates")
        gtype = ring.get("type")
        if gtype == "Polygon" and coords:
            return list(coords[0]) if coords else None
        if gtype == "MultiPolygon" and coords:
            best = None
            best_n = 0
            for poly in coords:
                if poly and len(poly[0]) > best_n:
                    best, best_n = list(poly[0]), len(poly[0])
            return best
        return None
    if hasattr(ring, "exterior"):
        try:
            return [(c[0], c[1]) for c in list(ring.exterior.coords)]
        except (AttributeError, TypeError, ValueError):
            pass
    if hasattr(ring, "contains") or hasattr(ring, "covers"):
        return ring
    if isinstance(ring, (list, tuple)):
        return list(ring)
    return None


def _ring_contains(ring, lon: float, lat: float) -> bool:
    norm = _as_ring_list(ring)
    if norm is None:
        return False
    if hasattr(norm, "contains") or hasattr(norm, "covers"):
        try:
            from shapely.geometry import Point
            pt = Point(lon, lat)
            if hasattr(norm, "covers"):
                try:
                    if norm.covers(pt):
                        return True
                except Exception:
                    pass
            return bool(norm.contains(pt))
        except Exception:
            return False
    return _point_in_ring(lon, lat, norm)


def _ring_area(ring: list) -> float:
    try:
        pts = [(float(p[0]), float(p[1])) for p in ring]
    except (IndexError, TypeError, ValueError):
        return 0.0
    if len(pts) < 3:
        return 0.0
    area = 0.0
    for i in range(len(pts) - 1):
        area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(area) / 2.0


def nearest_address(lon: float, lat: float,
                    addresses: list[tuple[float, float, str, str]],
                    max_m: float = 40, ring=None) -> str | None:
    """``"<housenumber> <street>"`` of the nearest address within ``max_m``.

    When ``ring`` (a building polygon, shapely or a ring list) is given,
    an address whose point lies inside it wins over a closer one outside.
    """
    if not addresses:
        return None
    scored = []
    for rec in addresses:
        try:
            alon, alat, house, street = rec
        except (TypeError, ValueError):
            continue
        d = haversine_m(lon, lat, alon, alat)
        if d <= max_m:
            scored.append((d, alon, alat, str(house).strip(),
                           str(street).strip()))
    if not scored:
        return None
    if ring is not None:
        inside = [(d, alon, alat, house, street) for
                  (d, alon, alat, house, street) in scored
                  if _ring_contains(ring, alon, alat)]
        if inside:
            inside.sort(key=lambda t: t[0])
            return f"{inside[0][3]} {inside[0][4]}"
    scored.sort(key=lambda t: t[0])
    return f"{scored[0][3]} {scored[0][4]}"


def zip_for(lon: float, lat: float,
            points: list[tuple[float, float, str]],
            default: str = "94025") -> tuple[str, str]:
    """ZIP of the nearest point within 600 m, else the default."""
    best, best_d = None, 600.0
    for plon, plat, z in points:
        d = haversine_m(lon, lat, plon, plat)
        if d <= best_d and (best is None or d < best_d):
            best, best_d = z, d
    if best is None:
        return default, "default"
    return best, "osm_nearest"


def _ring_centroid(ring: list) -> tuple[float, float] | None:
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    if not pts:
        return None
    return (sum(p[0] for p in pts) / len(pts),
            sum(p[1] for p in pts) / len(pts))


def _geom_centroid(geom: dict) -> tuple[float, float] | None:
    if not isinstance(geom, dict):
        return None
    coords = geom.get("coordinates")
    if geom.get("type") == "Point" and coords and len(coords) >= 2:
        return (float(coords[0]), float(coords[1]))
    rings: list[list] = []
    if geom.get("type") == "Polygon" and coords:
        rings = [coords[0]] if coords else []
    elif geom.get("type") == "MultiPolygon" and coords:
        rings = [poly[0] for poly in coords if poly]
    xs, ys, n = 0.0, 0.0, 0
    for ring in rings:
        c = _ring_centroid(ring)
        if c is None:
            continue
        xs += c[0] * max(len(ring) - 1, 1)
        ys += c[1] * max(len(ring) - 1, 1)
        n += max(len(ring) - 1, 1)
    if not n:
        return None
    return (xs / n, ys / n)


def _resolve(area_dir: Path, area: dict, key: str) -> object:
    val = area.get(key)
    if isinstance(val, dict) and set(val) == {"$ref"}:
        ref = area_dir / val["$ref"]
        return json.loads(ref.read_text(encoding="utf-8"))
    return val


def _nearest_road_name(lon: float, lat: float, roads: list) -> str | None:
    best, best_d = None, float("inf")
    for road in roads:
        if road.get("highway") not in ROAD_HIGHWAYS:
            continue
        name = road.get("name")
        if not name:
            continue
        geom = road.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if geom.get("type") == "LineString":
            lines = [coords]
        elif geom.get("type") == "MultiLineString":
            lines = coords
        else:
            continue
        for line in lines:
            for pt in line:
                d = haversine_m(lon, lat, pt[0], pt[1])
                if d < best_d:
                    best, best_d = name, d
    return best


def _nearest_node(lon: float, lat: float, nodes: dict) -> str | None:
    best, best_d = None, float("inf")
    for nid, coords in nodes.items():
        d = (coords[0] - lon) ** 2 + (coords[1] - lat) ** 2
        if d < best_d:
            best, best_d = nid, d
    return best


def _adjacency(edges: list) -> dict[str, list[tuple[str, float]]]:
    adj: dict[str, list] = defaultdict(list)
    for e in edges or []:
        frm, to, length = e.get("from"), e.get("to"), e.get("length_m")
        if not frm or not to or length is None:
            continue
        adj[frm].append((to, float(length)))
        adj[to].append((frm, float(length)))
    return adj


def _dijkstra(adj: dict, start: str) -> dict[str, float]:
    dist = {start: 0.0}
    heap = [(0.0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, w in adj.get(node, []):
            nd = d + w
            if nd < dist.get(nxt, float("inf")):
                dist[nxt] = nd
                heapq.heappush(heap, (nd, nxt))
    return dist


def _has_name(name: object) -> bool:
    return bool(name) and not NO_NAME_RE.match(str(name).strip())


def _building_ring(geom: dict | None) -> list | None:
    if not isinstance(geom, dict):
        return None
    coords = geom.get("coordinates")
    if geom.get("type") == "Polygon" and coords and coords[0]:
        return list(coords[0])
    if geom.get("type") == "MultiPolygon" and coords:
        best, best_a = None, -1.0
        for poly in coords:
            if poly and poly[0]:
                a = _ring_area(poly[0])
                if a > best_a:
                    best, best_a = list(poly[0]), a
        return best
    return None


def _building_area(geom: dict | None) -> float:
    ring = _building_ring(geom)
    return _ring_area(ring) if ring else 0.0


SHUTTLE_MIN_ASSUMED = 15  # Meta connector incl. wait (assumed, not public)


def _commute_facts(station: dict | None, commute: dict) -> dict:
    """Precomputed Caltrain commute facts for one ``us-st-*`` home."""
    walk = station.get("walk_minutes") if station else None
    ride = commute.get("caltrain_min")
    headway = commute.get("headway_min")
    bike = commute.get("last_mile_bike_min")
    foot = commute.get("last_mile_walk_min")
    if (walk is not None and headway is not None
            and ride is not None and bike is not None):
        total = round(walk + headway / 2 + ride + bike, 1)
    else:
        total = None
    return {
        "destination": "Menlo Park",
        "walk_to_station_min": {"value": walk, "source": "osm_graph"},
        "caltrain_min": {"value": ride, "source": "caltrain_gtfs"},
        "headway_min": {"value": headway, "source": "caltrain_gtfs"},
        "last_mile": {
            "bike_min": {"value": bike, "source": "osm_graph"},
            "walk_min": {"value": foot, "source": "osm_graph"},
            "shuttle_min_assumed": {"value": SHUTTLE_MIN_ASSUMED,
                                    "assumed": True, "source": "assumed"},
        },
        "total_min": {"value": total,
                      "sources": ["osm_graph", "caltrain_gtfs"]},
    }


def build_us_homes(area_dir: str | Path, zori: dict[str, dict],
                   points=None,
                   stats: dict | None = None,
                   addresses: list | None = None,
                   area_id: str | None = None,
                   default_zip: str = "94025",
                   commute: dict | None = None) -> list[dict]:
    """Group OSM apartment buildings into homes with ZORI rent.

    ``area_id`` defaults to the ``area`` key of ``area.json`` (``us-menlo``
    for the legacy file). ``commute`` (``us-st-*`` boxes only) carries the
    Caltrain ride/headway and the Menlo Park last mile; each home then gets
    a labelled ``commute`` block.
    """
    if isinstance(points, dict):
        if addresses is None:
            addresses = points.get("addresses") or []
        points = points.get("postcodes") or []
    if points is None:
        points = []
    if addresses is None:
        addresses = []
    area_dir = Path(area_dir)
    payload = json.loads((area_dir / "buildings.json").read_text(
        encoding="utf-8"))
    buildings = (payload.get("buildings", []) if isinstance(
        payload, dict) else payload)
    area = json.loads((area_dir / "area.json").read_text(encoding="utf-8"))
    graph = json.loads((area_dir / "graph.json").read_text(encoding="utf-8"))
    roads = _resolve(area_dir, area, "roads") or []
    pois = _resolve(area_dir, area, "pois") or []
    workplaces = area.get("workplaces") or {}
    if isinstance(workplaces, dict):
        workplaces = list(workplaces.values())
    meta_hq = next((w for w in workplaces if w.get("id") == "meta-hq"),
                   None)

    if area_id is None:
        area_id = area.get("area") or AREA_ID

    cands = []
    for b in sorted(buildings, key=lambda b: str(b.get("id"))):
        bval = b.get("building")
        keep_name = "anton menlo" in str(b.get("name") or "").lower()
        if not keep_name and bval == "dormitory":
            continue  # student housing
        if not keep_name and bval not in CANDIDATE_BUILDINGS:
            continue
        c = _geom_centroid(b.get("geometry") or {})
        if c is None:
            continue
        cands.append((b, c[0], c[1]))

    named: dict[str, list[int]] = defaultdict(list)
    unnamed: list[int] = []
    for i, (b, _lon, _lat) in enumerate(cands):
        name = b.get("name")
        if _has_name(name):
            named[str(name).strip()].append(i)
        else:
            unnamed.append(i)

    groups: list[tuple[str | None, list[int]]] = []
    for name in sorted(named):
        idxs = named[name]
        parent = {i: i for i in idxs}

        def _find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for a in range(len(idxs)):
            for c in range(a + 1, len(idxs)):
                ia, ib = idxs[a], idxs[c]
                if haversine_m(cands[ia][1], cands[ia][2],
                               cands[ib][1], cands[ib][2]) <= 300:
                    parent[_find(ia)] = _find(ib)
        clusters: dict[int, list[int]] = defaultdict(list)
        for i in idxs:
            clusters[_find(i)].append(i)
        for key in sorted(clusters, key=lambda k: min(clusters[k])):
            groups.append((name, sorted(clusters[key])))
    for i in sorted(unnamed):
        groups.append((None, [i]))

    nodes = graph.get("nodes") or {}
    walk_adj = _adjacency((graph.get("edges") or {}).get("walk"))
    bike_adj = _adjacency((graph.get("edges") or {}).get("bike"))
    box = {"graph": graph,
           "stations": [p for p in pois
                        if p.get("category") in STATION_CATEGORIES]}

    homes = []
    dropped = 0
    fallback_n = 0
    seq = 0
    for name, idxs in groups:
        lon = sum(cands[i][1] for i in idxs) / len(idxs)
        lat = sum(cands[i][2] for i in idxs) / len(idxs)
        lon_r, lat_r = round(lon, 7), round(lat, 7)
        zip_code, zip_source = zip_for(lon, lat, points,
                                         default=default_zip)
        z = zori.get(zip_code)
        if z is None:
            dropped += 1
            continue
        seq += 1
        if name is not None:
            home_name, match = name, "osm_name"
        else:
            addr = None
            if addresses:
                big = max(idxs, key=lambda i: (
                    _building_area(cands[i][0].get("geometry")), i))
                bloc, blat = cands[big][1], cands[big][2]
                bring = _building_ring(cands[big][0].get("geometry"))
                addr = nearest_address(bloc, blat, addresses, 40,
                                       ring=bring)
            if addr:
                home_name, match = addr, "osm_address"
            else:
                road = _nearest_road_name(lon, lat, roads)
                if road:
                    home_name = f"Apartments on {road}"
                else:
                    fallback_n += 1
                    home_name = f"Apartment building {fallback_n}"
                match = "osm"
        usd = z["monthly_usd"]
        st = nearest_station_walk(lon, lat, box)
        station = None
        if st and st["walk_minutes"] <= 40:
            station = {"station": st["station"],
                       "walk_minutes": st["walk_minutes"]}
        work_targets: dict = {}
        if meta_hq is not None and nodes:
            home_node = _nearest_node(lon, lat, nodes)
            hq_node = _nearest_node(meta_hq["lon"], meta_hq["lat"], nodes)
            entry = {"walk_m": None, "walk_minutes": None,
                     "bike_m": None, "bike_minutes": None,
                     "bike_speed_kmh": 15,
                     "bike_speed_source": "assumed"}
            if home_node and hq_node:
                if walk_adj:
                    dist = _dijkstra(walk_adj, home_node)
                    if hq_node in dist:
                        entry["walk_m"] = round(dist[hq_node], 1)
                        entry["walk_minutes"] = round(
                            dist[hq_node] / WALK_MPS / 60, 1)
                if bike_adj:
                    dist = _dijkstra(bike_adj, home_node)
                    if hq_node in dist:
                        entry["bike_m"] = round(dist[hq_node], 1)
                        entry["bike_minutes"] = round(
                            dist[hq_node] / BIKE_MPS / 60, 1)
            work_targets = {"meta-hq": entry}
        home = {
            "id": f"us-home-{seq:04d}",
            "name": home_name,
            "kind": "아파트",
            "region": area_id,
            "lon": lon_r,
            "lat": lat_r,
            "build_year": None,
            "pnu": None,
            "match": match,
            "osm_name": name,
            "scene": area_id,
            "station": station,
            "buckets": [{
                "center_m2": None,
                "range_m2": None,
                "trade": None,
                "jeonse": None,
                "wolse": {
                    "count": 1,
                    "deposit": None,
                    "monthly": {"count": 1, "median_won": usd,
                                "min_won": usd, "max_won": usd},
                },
            }],
            "currency": "USD",
            "country": "US",
            "price": {"source": "zillow_zori_zip", "zip": zip_code,
                      "zip_source": zip_source, "month": z["month"],
                      "label": ZORI_LABEL},
            "work_targets": work_targets,
        }
        if commute is not None:
            home["commute"] = _commute_facts(station, commute)
        homes.append(home)
    by_name: dict[str, list[int]] = defaultdict(list)
    for k, h in enumerate(homes):
        by_name[h["name"]].append(k)
    for dup_name, keys in by_name.items():
        if len(keys) > 1:
            ordered = sorted(keys, key=lambda k: (-homes[k]["lat"],
                                                  homes[k]["lon"]))
            for n, k in enumerate(ordered, start=1):
                homes[k]["name"] = f"{dup_name} · {n}"
    if stats is not None:
        stats["dropped_no_zori"] = dropped
    return homes


def us_area_ids() -> list[str]:
    """All US home areas: ``us-menlo`` plus every ``us-st-*`` box."""
    from .regions import US_CALTRAIN_BOX_IDS

    return [AREA_ID, *US_CALTRAIN_BOX_IDS]


def default_zip_for(area_id: str) -> str:
    """Per-box fallback ZIP when no ``addr:postcode`` is near a home."""
    if area_id == AREA_ID:
        return "94025"
    from .regions import US_CALTRAIN_BOXES

    for spec in US_CALTRAIN_BOXES:
        if spec["id"] == area_id:
            return spec["default_zip"]
    return "94025"


def load_caltrain_am(build_dir: str | Path) -> dict[str, dict]:
    """Station name -> ride/headway minutes from ``caltrain-am.json``."""
    path = Path(build_dir) / "region-us" / "caltrain-am.json"
    if not path.exists():
        return {}
    doc = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for row in doc.get("stations", []):
        out[row.get("station")] = {
            "caltrain_min": row.get("ride_min_to_menlo_park"),
            "headway_min": row.get("headway_min")}
    return out


def menlo_last_mile(build_dir: str | Path) -> tuple[float | None,
                                                    float | None]:
    """Walk/bike minutes Menlo Park station → Meta HQ on the us-menlo graph.

    Returns ``(walk_min, bike_min)``; either may be ``None`` when the
    graph or the station coordinate is unavailable.
    """
    build_dir = Path(build_dir)
    try:
        network = json.loads(
            (build_dir / "region-us" / "network.json").read_text(
                encoding="utf-8"))
        menlo = next(s for line in network.get("lines", [])
                     for s in line.get("stops", [])
                     if s.get("key") == "Menlo Park")
        area = json.loads(
            (build_dir / AREA_ID / "area.json").read_text(encoding="utf-8"))
        graph = json.loads(
            (build_dir / AREA_ID / "graph.json").read_text(encoding="utf-8"))
    except (OSError, ValueError, StopIteration):
        return None, None
    workplaces = area.get("workplaces") or {}
    if isinstance(workplaces, dict):
        workplaces = list(workplaces.values())
    meta_hq = next((w for w in workplaces if w.get("id") == "meta-hq"), None)
    nodes = graph.get("nodes") or {}
    if meta_hq is None or not nodes:
        return None, None
    station_node = _nearest_node(menlo["lon"], menlo["lat"], nodes)
    hq_node = _nearest_node(meta_hq["lon"], meta_hq["lat"], nodes)
    if not station_node or not hq_node:
        return None, None
    out: list = []
    for key, speed in (("walk", WALK_MPS), ("bike", BIKE_MPS)):
        adj = _adjacency((graph.get("edges") or {}).get(key))
        dist = _dijkstra(adj, station_node) if adj else {}
        out.append(round(dist[hq_node] / speed / 60, 1)
                   if hq_node in dist else None)
    return out[0], out[1]


def run_us_homes(build_dir: str | Path = DEFAULT_BUILD_DIR,
                 raw_dir: str | Path = DEFAULT_RAW_DIR) -> dict:
    """Write ``data/build/homes/us-*.json``; update summary.json."""
    build_dir, raw_dir = Path(build_dir), Path(raw_dir)
    zori = load_zori(raw_dir / ZORI_CSV)
    present = [a for a in us_area_ids()
               if (build_dir / a / "buildings.json").exists()]
    area_ids = present or [AREA_ID]
    am = load_caltrain_am(build_dir)
    last_walk, last_bike = menlo_last_mile(build_dir)

    out_dir = build_dir / "homes"
    out_dir.mkdir(parents=True, exist_ok=True)
    month = max((z["month"] for z in zori.values()), default=None)

    summary_path = out_dir / "summary.json"
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    other = dict(summary.get("other_regions") or {})

    reports = {}
    for area_id in area_ids:
        area_dir = build_dir / area_id
        extract = area_dir / "extract.osm.pbf"
        scanned = address_points(extract) if extract.exists() else {
            "postcodes": [], "addresses": []}
        points = scanned["postcodes"]
        stats: dict = {}
        commute = None
        if area_id != AREA_ID:
            from .regions import US_CALTRAIN_BOXES

            spec = next(s for s in US_CALTRAIN_BOXES
                        if s["id"] == area_id)
            ride = am.get(spec["station"], {})
            commute = {"station": spec["station"],
                       "caltrain_min": ride.get("caltrain_min"),
                       "headway_min": ride.get("headway_min"),
                       "last_mile_bike_min": last_bike,
                       "last_mile_walk_min": last_walk}
        homes = build_us_homes(area_dir, zori, points, stats=stats,
                               addresses=scanned["addresses"],
                               area_id=area_id,
                               default_zip=default_zip_for(area_id),
                               commute=commute)
        doc = {
            "region": area_id,
            "country": "US",
            "currency": "USD",
            "sources": [
                {"id": "zillow_zori",
                 "name": "Zillow Observed Rent Index (ZORI), ZIP, "
                         "smoothed, all homes",
                 "url": ZORI_URL,
                 "month": month},
                {"id": "osm", "name": "OpenStreetMap contributors",
                 "license": "ODbL"},
            ],
            "homes": homes,
        }
        if area_id != AREA_ID:
            doc["sources"].append(
                {"id": "caltrain_gtfs",
                 "name": "Caltrain GTFS (2026-06), weekday AM ride/headway",
                 "month": None})
        (out_dir / f"{area_id}.json").write_text(
            json.dumps(doc, ensure_ascii=False, indent=1) + "\n",
            encoding="utf-8")
        other[area_id] = {"homes": len(homes), "country": "US",
                      "currency": "USD"}
        zips: dict[str, int] = {}
        named = sum(1 for h in homes if h["match"] == "osm_name")
        named_by_address = sum(1 for h in homes
                               if h["match"] == "osm_address")
        names = [h["name"] for h in homes]
        duplicate_names_after = len(names) - len(set(names))
        with_station = sum(1 for h in homes if h.get("station"))
        bikes = [h["work_targets"]["meta-hq"]["bike_minutes"]
                 for h in homes
                 if h.get("work_targets", {}).get("meta-hq", {})
                 .get("bike_minutes") is not None]
        for h in homes:
            z = h["price"]["zip"]
            zips[z] = zips.get(z, 0) + 1
        reports[area_id] = {
            "area": area_id,
            "homes": len(homes),
            "named": named,
            "unnamed": len(homes) - named,
            "named_by_address": named_by_address,
            "duplicate_names_after": duplicate_names_after,
            "dropped_no_zori": stats.get("dropped_no_zori", 0),
            "zips": zips,
            "station_walk_share": (round(with_station / len(homes), 3)
                                   if homes else 0.0),
            "bike_minutes": {
                "min": min(bikes) if bikes else None,
                "median": statistics.median(bikes) if bikes else None,
                "max": max(bikes) if bikes else None,
            },
        }
    summary["other_regions"] = other
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    if len(reports) == 1:
        return reports[area_ids[0]]
    return {"areas": reports,
            "homes": sum(r["homes"] for r in reports.values()),
            "area_ids": area_ids}
