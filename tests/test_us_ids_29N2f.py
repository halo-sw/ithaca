"""Stage 29N2f — US home ids unique across areas.

``us-menlo`` keeps ``us-home-0001…`` (offset 0); each ``US_CALTRAIN_BOXES``
entry gets offset ``1000 * (its index + 1)``, so two area files never share
an id and the map/cards stop merging homes from different towns.
"""
import json
from pathlib import Path

import pytest

from pipeline.homes_us import build_us_homes, us_home_id_offset
from pipeline.regions import US_CALTRAIN_BOXES

LON0, LAT0 = -122.14823, 37.48485
ZORI = {"94025": {"monthly_usd": 4500, "month": "2026-09"},
        "94107": {"monthly_usd": 5200, "month": "2026-09"}}


def _sq(lon: float, lat: float, half: float = 0.00009) -> list:
    return [[lon - half, lat - half], [lon + half, lat - half],
            [lon + half, lat + half], [lon - half, lat + half],
            [lon - half, lat - half]]


def _building(bid: str, lon: float, lat: float) -> dict:
    return {"id": bid, "building": "apartments",
            "geometry": {"type": "Polygon",
                         "coordinates": [_sq(lon, lat)]}}


def _write(area_dir: Path, name: str, payload: dict) -> None:
    area_dir.mkdir(parents=True, exist_ok=True)
    (area_dir / name).write_text(json.dumps(payload), encoding="utf-8")


def _write_area(area_dir: Path, area_id: str) -> None:
    _write(area_dir, "buildings.json", {"buildings": [
        _building("b1", LON0 + 0.001, LAT0),
        _building("b2", LON0 + 0.004, LAT0),
    ]})
    _write(area_dir, "area.json", {
        "area": area_id,
        "roads": [],
        "pois": [{"id": "s1", "name": "San Francisco",
                  "category": "railway:station",
                  "geometry": {"type": "Point",
                               "coordinates": [LON0 + 0.002, LAT0]}}],
        "workplaces": [],
    })
    nodes = {f"n{i}": [LON0 + i * 0.001, LAT0] for i in range(5)}
    walk = []
    for i in range(4):
        walk.append({"from": f"n{i}", "to": f"n{i + 1}",
                     "length_m": 88.0})
        walk.append({"from": f"n{i + 1}", "to": f"n{i}",
                     "length_m": 88.0})
    _write(area_dir, "graph.json",
           {"nodes": nodes,
            "edges": {"walk": walk, "bike": [], "drive": []}})


def test_us_home_id_offset_blocks() -> None:
    assert us_home_id_offset("us-menlo") == 0
    assert us_home_id_offset("us-st-san-francisco") == 1000
    assert us_home_id_offset(US_CALTRAIN_BOXES[-1]["id"]) == 7000


def test_us_home_id_offset_unknown_raises() -> None:
    with pytest.raises(ValueError):
        us_home_id_offset("songpa-gu")


def test_two_areas_yield_disjoint_id_sets(tmp_path: Path) -> None:
    menlo_dir = tmp_path / "us-menlo"
    _write_area(menlo_dir, "us-menlo")
    sf_dir = tmp_path / "us-st-san-francisco"
    _write_area(sf_dir, "us-st-san-francisco")
    points = [(LON0 + 0.001, LAT0, "94025"),
              (LON0 + 0.004, LAT0, "94107")]
    menlo = build_us_homes(menlo_dir, ZORI, points,
                           area_id="us-menlo")
    sf = build_us_homes(sf_dir, ZORI, points,
                        area_id="us-st-san-francisco",
                        default_zip="94107")
    assert len(menlo) == 2 and len(sf) == 2
    menlo_ids = [h["id"] for h in menlo]
    sf_ids = [h["id"] for h in sf]
    assert menlo_ids[0] == "us-home-0001"
    assert sf_ids[0] == "us-home-1001"
    assert all(i.startswith("us-home-") for i in menlo_ids + sf_ids)
    assert set(menlo_ids).isdisjoint(sf_ids)
