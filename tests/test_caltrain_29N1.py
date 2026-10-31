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
from pipeline.areas import is_us_area, resolve_area
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
        ("Menlo Park", "15"), ("Palo Alto", "5"), ("Mountain View", "8")]
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
