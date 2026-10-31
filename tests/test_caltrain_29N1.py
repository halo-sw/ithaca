"""Stage 29N1: Caltrain network, US station boxes, per-box ZIP rent, commute.

Fixtures only: a 4-station GTFS zip, a two-ZIP ZORI table and synthetic
area dirs. No real PBF/CSV, no network.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import pipeline.areas as areas_mod
from pipeline.areas import (_gtfs_parent_station_coord, is_us_area,
                             resolve_area)
from pipeline.caltrain import build_caltrain
from pipeline.homes_us import (build_us_homes, default_zip_for, load_zori,
                               us_area_ids)

# SF -> San Jose order (descending latitude), Menlo Park in the middle.
STOPS = [
    ("SF", "San Francisco Caltrain Station", 37.7764, -122.3943),
    ("MP", "Menlo Park Station", 37.4546, -122.1821),
    ("PA", "Palo Alto Station", 37.4431, -122.1653),
    ("MV", "Mountain View Station", 37.3940, -122.0763),
]

# Weekday AM all-stop trips: SF dep, then +15/+5/+8 minutes per segment.
TRIPS = {
    "T1": ["07:00:00", "07:15:00", "07:20:00", "07:28:00"],
    "T2": ["07:20:00", "07:35:00", "07:40:00", "07:48:00"],
    "T3": ["07:40:00", "07:55:00", "08:00:00", "08:08:00"],
}


def _write_gtfs(path: Path) -> None:
    stops = [["stop_id", "stop_name", "stop_lat", "stop_lon",
              "location_type", "parent_station"]]
    for sid, name, lat, lon in STOPS:
        stops.append([sid, name, str(lat), str(lon), "1", ""])
        stops.append([f"{sid}-1", f"{name} platform", str(lat), str(lon),
                      "0", sid])
    trips = [["route_id", "service_id", "trip_id", "trip_headsign"],
             ["C", "WD", "T1", "San Jose"], ["C", "WD", "T2", "San Jose"],
             ["C", "WD", "T3", "San Jose"]]
    stop_times = [["trip_id", "arrival_time", "departure_time", "stop_id",
                   "stop_sequence"]]
    for tid, times in TRIPS.items():
        for seq, ((sid, *_), t) in enumerate(zip(STOPS, times), start=1):
            stop_times.append([tid, t, t, f"{sid}-1", str(seq)])
    calendar = [["service_id", "monday", "tuesday", "wednesday", "thursday",
                 "friday", "saturday", "sunday", "start_date", "end_date"],
                ["WD", "1", "1", "1", "1", "1", "0", "0",
                 "20260601", "20261231"]]

    def _csv(rows) -> str:
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        return buf.getvalue()

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("stops.txt", _csv(stops))
        zf.writestr("trips.txt", _csv(trips))
        zf.writestr("stop_times.txt", _csv(stop_times))
        zf.writestr("calendar.txt", _csv(calendar))


def _build(tmp_path: Path) -> dict:
    gtfs = tmp_path / "caltrain.zip"
    _write_gtfs(gtfs)
    return build_caltrain(gtfs, tmp_path / "region-us",
                          tmp_path / "scenarios")


def test_network_one_line_in_order(tmp_path: Path) -> None:
    out = _build(tmp_path)
    network = json.loads(Path(out["network"]).read_text(encoding="utf-8"))
    assert [line["id"] for line in network["lines"]] == ["caltrain"]
    line = network["lines"][0]
    assert line["name"] == "Caltrain"
    assert network["transfers"] == []
    assert network["meta"]["source"] == "Caltrain GTFS (2026-06)"
    names = [s["name"] for s in line["stops"]]
    assert names == ["San Francisco", "Menlo Park", "Palo Alto",
                     "Mountain View"]
    pattern = line["patterns"][0]
    assert pattern["stops"] == [s["id"] for s in line["stops"]]
    chainage = pattern["chainage_km"]
    assert chainage[0] == 0.0
    assert all(b > a for a, b in zip(chainage, chainage[1:]))


def test_interstation_csv_median_minutes(tmp_path: Path) -> None:
    out = _build(tmp_path)
    with open(out["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert fh_fieldnames(out["csv"]) == ["연번", "호선", "역명", "소요시간",
                                         "역간거리(km)", "호선별누계(km)"]
    assert [(r["역명"], r["소요시간"]) for r in rows] == [
        ("Menlo Park", "15:00"), ("Palo Alto", "05:00"),
        ("Mountain View", "08:00")]
    assert all(r["호선"] == "Caltrain" for r in rows)
    cum = [float(r["호선별누계(km)"]) for r in rows]
    assert all(b > a for a, b in zip(cum, cum[1:]))


def fh_fieldnames(path: str) -> list[str]:
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh).fieldnames or [])


def test_am_ride_to_menlo_park_and_headway(tmp_path: Path) -> None:
    out = _build(tmp_path)
    am = json.loads(Path(out["am"]).read_text(encoding="utf-8"))
    by_station = {s["station"]: s for s in am["stations"]}
    assert set(by_station) == {"San Francisco", "Palo Alto",
                               "Mountain View"}
    assert by_station["San Francisco"]["ride_min_to_menlo_park"] == 15
    assert by_station["Palo Alto"]["ride_min_to_menlo_park"] == 5
    assert by_station["Mountain View"]["ride_min_to_menlo_park"] == 13
    assert by_station["San Francisco"]["headway_min"] == 20
    assert all(s["source"] == "caltrain_gtfs" for s in am["stations"])


ZORI_CSV = """RegionID,SizeRank,RegionName,RegionType,StateName,State,City,Metro,CountyName,2026-08-31,2026-09-30
1,1,94025,zip,California,CA,Menlo Park,San Jose,San Mateo,4500,4525
2,2,94301,zip,California,CA,Palo Alto,San Jose,Santa Clara,7900,7950
"""


def _sq(lon: float, lat: float, half: float = 0.00009) -> list:
    return [[lon - half, lat - half], [lon + half, lat - half],
            [lon + half, lat + half], [lon - half, lat + half],
            [lon - half, lat - half]]


def _write_box(area_dir: Path, area_id: str, lon: float, lat: float,
               station: str) -> None:
    area_dir.mkdir(parents=True, exist_ok=True)
    (area_dir / "buildings.json").write_text(json.dumps({"buildings": [
        {"id": "b1", "building": "apartments", "name": "Box Apartments",
         "geometry": {"type": "Polygon",
                      "coordinates": [_sq(lon, lat)]}}]}),
        encoding="utf-8")
    (area_dir / "area.json").write_text(json.dumps({
        "area": area_id, "roads": [],
        "pois": [{"id": "s1", "name": station, "category": "railway:station",
                  "geometry": {"type": "Point",
                               "coordinates": [lon, lat]}}],
        "workplaces": [{"id": "meta-hq", "lon": -122.14823,
                        "lat": 37.48485}]}), encoding="utf-8")
    edges = [{"from": "n0", "to": "n1", "length_m": 88.0},
             {"from": "n1", "to": "n0", "length_m": 88.0}]
    (area_dir / "graph.json").write_text(json.dumps(
        {"nodes": {"n0": [lon, lat], "n1": [lon + 0.001, lat]},
         "edges": {"walk": edges, "bike": edges, "drive": []}}),
        encoding="utf-8")


def test_two_boxes_different_zip_rent(tmp_path: Path) -> None:
    zori_path = tmp_path / "zori.csv"
    zori_path.write_text(ZORI_CSV, encoding="utf-8")
    zori = load_zori(zori_path)
    menlo = tmp_path / "us-menlo"
    pa = tmp_path / "us-st-palo-alto"
    _write_box(menlo, "us-menlo", -122.14823, 37.48485, "Menlo Park")
    _write_box(pa, "us-st-palo-alto", -122.1653, 37.4431, "Palo Alto")
    # No addr:postcode nearby: per-box defaults decide the ZIP.
    menlo_homes = build_us_homes(menlo, zori, [],
                                 default_zip=default_zip_for("us-menlo"))
    pa_homes = build_us_homes(pa, zori, [],
                              default_zip=default_zip_for(
                                  "us-st-palo-alto"))
    assert default_zip_for("us-menlo") == "94025"
    assert default_zip_for("us-st-palo-alto") == "94301"
    menlo_monthly = menlo_homes[0]["buckets"][0]["wolse"]["monthly"]
    pa_monthly = pa_homes[0]["buckets"][0]["wolse"]["monthly"]
    assert menlo_monthly["median_won"] == 4525
    assert pa_monthly["median_won"] == 7950
    assert menlo_homes[0]["price"]["zip"] == "94025"
    assert pa_homes[0]["price"]["zip"] == "94301"
    assert pa_homes[0]["region"] == "us-st-palo-alto"


def test_us_box_spec_resolves(monkeypatch) -> None:
    assert is_us_area("us-st-palo-alto")
    assert "us-st-palo-alto" in us_area_ids()

    def _fake_lookup(station, raw_pbf, osmium_bin="osmium"):
        assert station == "Palo Alto"
        return {"name": station, "lon": -122.1653, "lat": 37.4431,
                "osm_kind": "node", "osm_id": 1}

    monkeypatch.setattr(areas_mod, "_lookup_us_station", _fake_lookup)
    area = resolve_area("us-st-palo-alto")
    assert area.id == "us-st-palo-alto"
    assert area.country == "US"
    assert area.currency == "USD"
    assert area.center == (-122.1653, 37.4431)
    minlon, minlat, maxlon, maxlat = area.bbox
    assert maxlon - minlon > 0.012 and maxlat - minlat > 0.010
    assert area.workplaces[0]["id"] == "meta-hq"


def test_total_min_formula(tmp_path: Path) -> None:
    zori = {"94301": {"monthly_usd": 7950, "month": "2026-09"}}
    area_dir = tmp_path / "us-st-palo-alto"
    _write_box(area_dir, "us-st-palo-alto", -122.1653, 37.4431, "Palo Alto")
    commute = {"station": "Palo Alto", "caltrain_min": 5, "headway_min": 20,
               "last_mile_bike_min": 12.0, "last_mile_walk_min": 30.0}
    homes = build_us_homes(area_dir, zori, [], default_zip="94301",
                           commute=commute)
    facts = homes[0]["commute"]
    walk = facts["walk_to_station_min"]["value"]
    assert facts["walk_to_station_min"]["source"] == "osm_graph"
    assert facts["caltrain_min"] == {"value": 5, "source": "caltrain_gtfs"}
    assert facts["headway_min"] == {"value": 20,
                                    "source": "caltrain_gtfs"}
    assert facts["last_mile"]["shuttle_min_assumed"]["value"] == 15
    assert facts["last_mile"]["shuttle_min_assumed"]["assumed"] is True
    assert facts["total_min"]["value"] == round(walk + 20 / 2 + 5 + 12.0, 1)


def test_gtfs_parent_station_fallback_osm_less_box(tmp_path, monkeypatch
                                                   ) -> None:
    gtfs = tmp_path / "caltrain.zip"
    _write_gtfs(gtfs)
    info = _gtfs_parent_station_coord("San Francisco", gtfs)
    assert (info["lon"], info["lat"]) == (-122.3943, 37.7764)

    class _EmptyScan:
        def __init__(self, names):
            self.names = names
            self.hits = []

        def apply_file(self, *args, **kwargs):
            return None

    monkeypatch.setattr(areas_mod, "_CandidateScan", _EmptyScan)
    monkeypatch.setattr(areas_mod, "US_GTFS_ZIP", gtfs)
    resolved = areas_mod._lookup_us_station(
        "San Francisco", tmp_path / "norcal.osm.pbf", osmium_bin="true")
    assert (resolved["lon"], resolved["lat"]) == (-122.3943, 37.7764)


def test_gtfs_fallback_matches_fourth_and_king(tmp_path: Path) -> None:
    path = tmp_path / "mini.zip"
    stops = [["stop_id", "stop_name", "stop_lat", "stop_lon",
              "location_type", "parent_station"],
             ["KING", "4th & King", 37.7764, -122.3943, "1", ""],
             ["KING-1", "4th & King platform", 37.7764, -122.3943,
              "0", "KING"]]
    trips = [["route_id", "service_id", "trip_id", "trip_headsign"],
             ["C", "WD", "T1", "San Jose"]]
    stop_times = [["trip_id", "arrival_time", "departure_time", "stop_id",
                   "stop_sequence"],
                  ["T1", "07:00:00", "07:00:00", "KING-1", "1"]]
    calendar = [["service_id", "monday", "tuesday", "wednesday",
                 "thursday", "friday", "saturday", "sunday",
                 "start_date", "end_date"],
                ["WD", "1", "1", "1", "1", "1", "0", "0",
                 "20260601", "20261231"]]

    def _csv(rows) -> str:
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        return buf.getvalue()

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("stops.txt", _csv(stops))
        zf.writestr("trips.txt", _csv(trips))
        zf.writestr("stop_times.txt", _csv(stop_times))
        zf.writestr("calendar.txt", _csv(calendar))
    info = _gtfs_parent_station_coord("San Francisco", path)
    assert (info["lon"], info["lat"]) == (-122.3943, 37.7764)


def _write_custom_box(area_dir: Path, area_id: str, buildings: list,
                      station: str, hq: tuple[float, float],
                      roads: list | None = None,
                      landuse: list | None = None) -> None:
    area_dir.mkdir(parents=True, exist_ok=True)
    (area_dir / "buildings.json").write_text(
        json.dumps({"buildings": buildings}), encoding="utf-8")
    lon = buildings[0]["geometry"]["coordinates"][0][0][0]
    lat = buildings[0]["geometry"]["coordinates"][0][0][1]
    (area_dir / "area.json").write_text(json.dumps({
        "area": area_id, "roads": roads or [], "landuse": landuse or [],
        "pois": [{"id": "s1", "name": station, "category": "railway:station",
                  "geometry": {"type": "Point",
                               "coordinates": [lon, lat]}}],
        "workplaces": [{"id": "meta-hq", "lon": hq[0], "lat": hq[1]}]}),
        encoding="utf-8")
    edges = [{"from": "n0", "to": "n1", "length_m": 88.0},
             {"from": "n1", "to": "n0", "length_m": 88.0}]
    (area_dir / "graph.json").write_text(json.dumps(
        {"nodes": {"n0": [lon, lat], "n1": [lon + 0.001, lat]},
         "edges": {"walk": edges, "bike": edges, "drive": []}}),
        encoding="utf-8")


def _poly(lon: float, lat: float, half: float = 0.00009) -> dict:
    return {"type": "Polygon", "coordinates": [_sq(lon, lat, half)]}


ZORI_94025 = {"94025": {"monthly_usd": 4500, "month": "2026-09"}}


def test_digit_only_names_become_address(tmp_path: Path) -> None:
    lon, lat = -122.0763, 37.3940
    area_dir = tmp_path / "us-st-mountain-view"
    _write_custom_box(area_dir, "us-st-mountain-view", [
        {"id": "b1", "building": "apartments", "name": "10",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments", "name": "11C",
         "geometry": _poly(lon + 0.002, lat)},
    ], "Mountain View", (-122.14823, 37.48485))
    addresses = [(lon, lat, "10", "Main St"),
                 (lon + 0.002, lat, "11", "Main St")]
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=addresses,
                           default_zip="94025",
                           named_nodes=[])
    by_name = {h["name"]: h for h in homes}
    assert by_name["10 Main St"]["match"] == "osm_address"
    assert by_name["11 Main St"]["match"] == "osm_address"


def test_named_node_attaches_and_orphan_becomes_home(
        tmp_path: Path) -> None:
    lon, lat = -122.1821, 37.4546
    area_dir = tmp_path / "us-menlo"
    _write_custom_box(area_dir, "us-menlo", [
        {"id": "b1", "building": "apartments",
         "geometry": _poly(lon, lat)},
    ], "Menlo Park", (lon, lat))
    homes = build_us_homes(
        area_dir, ZORI_94025, [], addresses=[], default_zip="94025",
        named_nodes=[{"name": "Anton Menlo Park",
                      "lon": lon + 0.0001, "lat": lat},
                     {"name": "Faraway Court",
                      "lon": lon + 0.5, "lat": lat + 0.5}])
    by_name = {h["name"]: h for h in homes}
    assert by_name["Anton Menlo Park"]["match"] == "osm_node_name"
    far = by_name["Faraway Court"]
    assert far["match"] == "osm_node_name"
    assert (far["lon"], far["lat"]) == (round(lon + 0.5, 7),
                                        round(lat + 0.5, 7))


def test_best_mode_bike_near_and_caltrain_far(tmp_path: Path) -> None:
    lon, lat = -122.1653, 37.4431
    commute = {"station": "Palo Alto", "caltrain_min": 20,
               "headway_min": 20, "last_mile_bike_min": 8.8,
               "last_mile_walk_min": 20.0}
    near = tmp_path / "near"
    _write_custom_box(near, "us-st-palo-alto", [
        {"id": "b1", "building": "apartments", "name": "Near Homes",
         "geometry": _poly(lon, lat)},
    ], "Palo Alto", (lon + 0.068, lat))
    facts = build_us_homes(near, ZORI_94025, [], default_zip="94025",
                           commute=commute, named_nodes=[])[0]["commute"]
    assert facts["bike_direct_min"]["source"] == "estimate"
    assert facts["best"]["mode"] == "bike"
    assert facts["best"]["min"] == facts["bike_direct_min"]["value"]
    assert facts["best"]["min"] < facts["total_min"]["value"]

    far = tmp_path / "far"
    _write_custom_box(far, "us-st-palo-alto", [
        {"id": "b1", "building": "apartments", "name": "Far Homes",
         "geometry": _poly(lon, lat)},
    ], "Palo Alto", (lon + 0.34, lat))
    facts = build_us_homes(far, ZORI_94025, [], default_zip="94025",
                           commute=commute, named_nodes=[])[0]["commute"]
    assert facts["best"]["mode"] == "caltrain"
    assert facts["best"]["min"] == facts["total_min"]["value"]


def _write_skip_gtfs(path: Path) -> None:
    stops = [["stop_id", "stop_name", "stop_lat", "stop_lon",
              "location_type", "parent_station"]]
    for sid, name, lat, lon in STOPS:
        stops.append([sid, name, str(lat), str(lon), "1", ""])
        stops.append([f"{sid}-1", f"{name} platform", str(lat), str(lon),
                      "0", sid])
    # T1 skips Palo Alto, T2 skips Menlo Park: no AM trip serves
    # Menlo Park -> Palo Alto back-to-back.
    trips = [["route_id", "service_id", "trip_id", "trip_headsign"],
             ["C", "WD", "T1", "San Jose"], ["C", "WD", "T2", "San Jose"]]
    runs = {"T1": [("SF", "07:00:00"), ("MP", "07:15:00"),
                   ("MV", "07:28:00")],
            "T2": [("SF", "07:20:00"), ("PA", "07:40:00"),
                   ("MV", "07:48:00")]}
    stop_times = [["trip_id", "arrival_time", "departure_time", "stop_id",
                   "stop_sequence"]]
    for tid, legs in runs.items():
        for seq, (sid, t) in enumerate(legs, start=1):
            stop_times.append([tid, t, t, f"{sid}-1", str(seq)])
    calendar = [["service_id", "monday", "tuesday", "wednesday",
                 "thursday", "friday", "saturday", "sunday",
                 "start_date", "end_date"],
                ["WD", "1", "1", "1", "1", "1", "0", "0",
                 "20260601", "20261231"]]

    def _csv(rows) -> str:
        buf = io.StringIO()
        csv.writer(buf).writerows(rows)
        return buf.getvalue()

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("stops.txt", _csv(stops))
        zf.writestr("trips.txt", _csv(trips))
        zf.writestr("stop_times.txt", _csv(stop_times))
        zf.writestr("calendar.txt", _csv(calendar))


def test_interstation_csv_mmss_no_empty_and_interpolated(
        tmp_path: Path) -> None:
    out = _build(tmp_path)
    with open(out["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    import re
    assert rows
    for r in rows:
        assert r["소요시간"], r["역명"]
        assert re.fullmatch(r"\d{2}:\d{2}", r["소요시간"]), r

    gtfs = tmp_path / "skip.zip"
    _write_skip_gtfs(gtfs)
    out = build_caltrain(gtfs, tmp_path / "region-us",
                         tmp_path / "scenarios")
    with open(out["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    by_station = {r["역명"]: r["소요시간"] for r in rows}
    assert by_station["Palo Alto"]
    assert re.fullmatch(r"\d{2}:\d{2}", by_station["Palo Alto"])
    assert all(r["소요시간"] for r in rows)
    am = json.loads(Path(out["am"]).read_text(encoding="utf-8"))
    assert "Palo Alto" in am["meta"]["interpolated"]


def _anton_buildings(lon: float, lat: float) -> list:
    return [
        {"id": "b1", "building": "apartments", "name": "Building A",
         "levels": 3, "geometry": _poly(lon, lat, 0.00009)},
        {"id": "b2", "building": "apartments", "name": "Building B",
         "levels": 5, "geometry": _poly(lon + 0.0003, lat, 0.00012)},
        {"id": "b3", "building": "apartments", "name": "Building C",
         "levels": 4, "geometry": _poly(lon, lat + 0.0003, 0.00006)},
    ]


def _anton_addresses(lon: float, lat: float) -> list:
    return [(lon + 0.00015, lat + 0.00015, "3639", "Haven Avenue")]


def test_named_residential_polygon_groups_letter_buildings(
        tmp_path: Path) -> None:
    lon, lat = -122.14823, 37.48485
    pad = 0.001
    poly = [[lon - pad, lat - pad], [lon + pad, lat - pad],
            [lon + pad, lat + pad], [lon - pad, lat + pad],
            [lon - pad, lat - pad]]
    landuse = [{"id": "w1", "kind": "landuse:residential",
                "name": "Anton Menlo Park",
                "geometry": {"type": "Polygon", "coordinates": [poly]}}]
    area_dir = tmp_path / "us-menlo"
    _write_custom_box(area_dir, "us-menlo", _anton_buildings(lon, lat),
                      "Menlo Park", (lon, lat), landuse=landuse)
    homes = build_us_homes(area_dir, ZORI_94025, [],
                           addresses=_anton_addresses(lon, lat),
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    home = homes[0]
    assert home["name"] == "Anton Menlo Park"
    assert home["match"] == "osm_area_name"
    assert home["buildings"] == 3
    assert home["levels_max"] == 5
    assert home["address"] == "3639 Haven Avenue"
    assert (home["lon"], home["lat"]) == (round(lon + 0.0003, 7),
                                         round(lat, 7))


def test_named_residential_multipolygon_groups_letter_buildings(
        tmp_path: Path) -> None:
    lon, lat = -122.14823, 37.48485
    pad = 0.001
    upper = [[lon - pad, lat + 0.0002], [lon + pad, lat + 0.0002],
             [lon + pad, lat + pad], [lon - pad, lat + pad],
             [lon - pad, lat + 0.0002]]
    lower = [[lon - pad, lat - pad], [lon + pad, lat - pad],
             [lon + pad, lat + 0.0002], [lon - pad, lat + 0.0002],
             [lon - pad, lat - pad]]
    landuse = [{"id": "r1", "kind": "landuse:residential",
                "name": "Anton Menlo Park",
                "geometry": {"type": "MultiPolygon",
                             "coordinates": [[upper], [lower]]}}]
    area_dir = tmp_path / "us-menlo"
    _write_custom_box(area_dir, "us-menlo", _anton_buildings(lon, lat),
                      "Menlo Park", (lon, lat), landuse=landuse)
    homes = build_us_homes(area_dir, ZORI_94025, [],
                           addresses=_anton_addresses(lon, lat),
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    home = homes[0]
    assert home["name"] == "Anton Menlo Park"
    assert home["match"] == "osm_area_name"
    assert home["buildings"] == 3
    assert home["address"] == "3639 Haven Avenue"


def test_single_letter_names_fall_back_to_address(
        tmp_path: Path) -> None:
    lon, lat = -122.0763, 37.3940
    area_dir = tmp_path / "us-st-mountain-view"
    _write_custom_box(area_dir, "us-st-mountain-view", [
        {"id": "b1", "building": "apartments", "name": "A",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments", "name": "B",
         "geometry": _poly(lon + 0.002, lat)},
    ], "Mountain View", (-122.14823, 37.48485))
    addresses = [(lon, lat, "100", "Villa St"),
                 (lon + 0.002, lat, "200", "Villa St")]
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=addresses,
                           default_zip="94025", named_nodes=[])
    by_name = {h["name"]: h for h in homes}
    assert by_name["100 Villa St"]["match"] == "osm_address"
    assert by_name["200 Villa St"]["match"] == "osm_address"


def test_shared_address_and_stem_merge_into_one_home(
        tmp_path: Path) -> None:
    lon, lat = -122.1068, 37.4848
    area_dir = tmp_path / "us-st-san-carlos"
    roads = [{"id": "r1", "highway": "residential", "name": "Laurel Street",
              "geometry": {"type": "LineString",
                           "coordinates": [[lon, lat],
                                           [lon + 0.0002, lat]]}}]
    _write_custom_box(area_dir, "us-st-san-carlos", [
        {"id": "b1", "building": "apartments",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments",
         "geometry": _poly(lon + 0.0002, lat)},
    ], "San Carlos", (-122.14823, 37.48485), roads=roads)
    addresses = [(lon + 0.0001, lat, "800", "Laurel Street")]
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=addresses,
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    home = homes[0]
    assert home["name"] == "Apartments on Laurel Street"
    assert home["match"] == "osm"
    assert home["buildings"] == 2
    assert home["address"] == "800 Laurel Street"


def test_same_name_buildings_nearby_merge_into_one_home(
        tmp_path: Path) -> None:
    lon, lat = -122.14823, 37.48485
    area_dir = tmp_path / "us-menlo"
    _write_custom_box(area_dir, "us-menlo", [
        {"id": "b1", "building": "apartments", "name": "1221 Willow Road",
         "levels": 2, "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments", "name": "1221 Willow Road",
         "levels": 5, "geometry": _poly(lon + 0.00045, lat)},
    ], "Menlo Park", (lon, lat))
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=[],
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    assert homes[0]["name"] == "1221 Willow Road"
    assert homes[0]["buildings"] == 2
    assert homes[0]["levels_max"] == 5
    assert "· " not in homes[0]["name"]


def test_same_name_homes_far_apart_carry_address(
        tmp_path: Path) -> None:
    lon, lat = -122.15000, 37.48000
    area_dir = tmp_path / "us-menlo"
    _write_custom_box(area_dir, "us-menlo", [
        {"id": "b1", "building": "apartments",
         "name": "Ironworks Apartments",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments",
         "name": "Ironworks Apartments",
         "geometry": _poly(lon + 0.007, lat)},
    ], "Menlo Park", (lon, lat))
    addresses = [(lon, lat, "1000", "Alma St"),
                 (lon + 0.007, lat, "2000", "Alma St")]
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=addresses,
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 2
    names = sorted(h["name"] for h in homes)
    assert names == ["Ironworks Apartments, 1000 Alma St",
                     "Ironworks Apartments, 2000 Alma St"]
    assert all("· " not in h["name"] for h in homes)


def test_street_template_buildings_nearby_merge_into_one_home(
        tmp_path: Path) -> None:
    lon, lat = -122.1068, 37.4848
    area_dir = tmp_path / "us-st-san-carlos"
    roads = [{"id": "r1", "highway": "residential", "name": "Laurel Street",
              "geometry": {"type": "LineString",
                           "coordinates": [[lon - 0.0002, lat],
                                           [lon + 0.0012, lat]]}}]
    _write_custom_box(area_dir, "us-st-san-carlos", [
        {"id": "b1", "building": "apartments",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments",
         "geometry": _poly(lon + 0.0005, lat)},
        {"id": "b3", "building": "apartments",
         "geometry": _poly(lon + 0.0009, lat)},
    ], "San Carlos", (-122.14823, 37.48485), roads=roads)
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=[],
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    assert homes[0]["name"] == "Apartments on Laurel Street"
    assert homes[0]["buildings"] == 3


def test_unnamed_building_with_nearby_address_is_named_by_it(
        tmp_path: Path) -> None:
    lon, lat = -122.1068, 37.4848
    area_dir = tmp_path / "us-st-san-carlos"
    roads = [{"id": "r1", "highway": "residential", "name": "Laurel Street",
              "geometry": {"type": "LineString",
                           "coordinates": [[lon, lat],
                                           [lon + 0.0002, lat]]}}]
    _write_custom_box(area_dir, "us-st-san-carlos", [
        {"id": "b1", "building": "apartments",
         "geometry": _poly(lon, lat)},
    ], "San Carlos", (-122.14823, 37.48485), roads=roads)
    addresses = [(lon + 0.00023, lat, "158", "Laurel Street")]
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=addresses,
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 1
    assert homes[0]["name"] == "158 Laurel Street"
    assert homes[0]["match"] == "osm_address"


def test_far_apart_street_clusters_use_cross_street_names(
        tmp_path: Path) -> None:
    lon, lat = -122.1068, 37.4848
    area_dir = tmp_path / "us-st-san-carlos"
    roads = [
        {"id": "r1", "highway": "residential", "name": "Laurel Street",
         "geometry": {"type": "LineString",
                      "coordinates": [[lon - 0.0003, lat],
                                      [lon + 0.0002, lat],
                                      [lon + 0.007, lat],
                                      [lon + 0.0075, lat]]}},
        {"id": "r2", "highway": "residential", "name": "Arroyo Avenue",
         "geometry": {"type": "LineString",
                      "coordinates": [[lon - 0.0002, lat + 0.00035],
                                      [lon + 0.0006, lat + 0.00035]]}},
        {"id": "r3", "highway": "residential", "name": "Beech Street",
         "geometry": {"type": "LineString",
                      "coordinates": [[lon + 0.0064, lat + 0.00035],
                                      [lon + 0.0076, lat + 0.00035]]}},
    ]
    _write_custom_box(area_dir, "us-st-san-carlos", [
        {"id": "b1", "building": "apartments",
         "geometry": _poly(lon, lat)},
        {"id": "b2", "building": "apartments",
         "geometry": _poly(lon + 0.0004, lat)},
        {"id": "b3", "building": "apartments",
         "geometry": _poly(lon + 0.0068, lat)},
        {"id": "b4", "building": "apartments",
         "geometry": _poly(lon + 0.0072, lat)},
    ], "San Carlos", (-122.14823, 37.48485), roads=roads)
    homes = build_us_homes(area_dir, ZORI_94025, [], addresses=[],
                           default_zip="94025", named_nodes=[])
    assert len(homes) == 2
    names = sorted(h["name"] for h in homes)
    assert names == ["Apartments on Laurel Street near Arroyo Avenue",
                     "Apartments on Laurel Street near Beech Street"]
    assert all("· " not in h["name"] for h in homes)
