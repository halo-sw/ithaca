"""Stage 38a: US-filtered rebuilds, home-box cover, hm- lookups."""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.areas import resolve_home_box
from pipeline.boxes import (
    MAX_BOXES,
    REQUIRED_STATIONS,
    _place_name_for,
    select_boxes,
    select_home_boxes,
)
from pipeline.cli import expand_area_patterns
from pipeline.homes import korean_regions


def test_korean_regions_drops_us():
    regions = [
        {"id": "seongdong", "label": "서울 성동구"},
        {"id": "us-menlo", "country": "US", "label": "Menlo Park"},
    ]
    out = korean_regions(regions)
    assert [r["id"] for r in out] == ["seongdong"]


def _homes_cluster():
    homes = []
    # 20 points inside one ~700 m square, far from the station.
    for ix in range(4):
        for iy in range(5):
            homes.append({"lon": 127.10 + ix * 0.002,
                          "lat": 37.50 + iy * 0.002,
                          "region": "gangdong"})
    # 5 isolated points, far from everything.
    for i in range(5):
        homes.append({"lon": 127.30 + i * 0.02, "lat": 37.50,
                      "region": "gangdong"})
    # 10 points inside the station box: never counted.
    for i in range(10):
        homes.append({"lon": 127.0 + i * 0.0005, "lat": 37.50,
                      "region": "gangdong"})
    return homes


def _station_boxes():
    return [{"station": "중심", "lon": 127.0, "lat": 37.50,
             "region": "gangdong", "region_label": "서울 강동구",
             "count": 10}]


def _scanned():
    return {"gangdong": {"_label": "서울 강동구", "places": []}}


def test_select_home_boxes_covers_cluster_only():
    out = select_home_boxes(_homes_cluster(), _station_boxes(), _scanned())
    assert len(out) == 1
    row = out[0]
    assert row["homes"] == 20
    assert row["id"] == "hm-gangdong-01"
    assert row["region"] == "gangdong"
    assert row["label"].endswith(" 일대")


def test_select_home_boxes_deterministic():
    first = select_home_boxes(_homes_cluster(), _station_boxes(), _scanned())
    second = select_home_boxes(_homes_cluster(), _station_boxes(), _scanned())
    assert [r["id"] for r in first] == [r["id"] for r in second]
    assert first == second


def test_home_box_name_prefers_nearest_place():
    scanned = {"gangdong": {"_label": "서울 강동구", "places": [
        {"name": "먼동", "lon": 127.105, "lat": 37.508},
        {"name": "가까운동", "lon": 127.101, "lat": 37.501},
    ]}}
    assert _place_name_for(127.10, 37.50, "gangdong", scanned) == "가까운동"
    homes = [{"lon": 127.10, "lat": 37.50, "region": "gangdong"}] * 8
    out = select_home_boxes(homes, [], scanned)
    assert out and out[0]["label"] == "가까운동 일대"


def test_home_box_name_falls_back_to_region():
    assert _place_name_for(127.10, 37.50, "gangdong", _scanned()) == "강동구"


def test_home_patterns_and_resolve(tmp_path):
    (tmp_path / "station-boxes.json").write_text(json.dumps({
        "boxes": [],
        "home_boxes": [
            {"id": "hm-gangdong-01", "lon": 127.10, "lat": 37.50,
             "region": "gangdong", "region_label": "서울 강동구",
             "homes": 20, "label": "강동구 일대"},
            {"id": "hm-bundang-01", "lon": 127.11, "lat": 37.39,
             "region": "bundang", "region_label": "성남시 분당구",
             "homes": 9, "label": "분당동 일대"},
        ]}), encoding="utf-8")
    assert expand_area_patterns(["home:*"], tmp_path) == [
        "hm-gangdong-01", "hm-bundang-01"]
    assert expand_area_patterns(["region:gangdong"], tmp_path) == [
        "hm-gangdong-01"]
    area = resolve_home_box("hm-gangdong-01", tmp_path)
    assert area.kind == "bbox"
    assert area.label == "강동구 일대"
    assert area.station is None
    assert area.bbox is not None and len(area.bbox) == 4


def _station_entry(name, lon, oid):
    tags = {"name": name, "railway": "subway_station",
            "network": "수도권 전철"}
    return {"kind": "node", "id": oid, "tags": tags,
            "lon": lon, "lat": 37.50}


def test_select_boxes_default_cap_keeps_70():
    assert MAX_BOXES == 200
    stations, apartments = [], []
    for i in range(70):
        lon = 127.0 + i * 0.01
        stations.append(_station_entry(f"역{i:02d}", lon, 100 + i))
        apartments.extend([(lon, 37.50)] * 5)
    scanned = {"r1": {"stations": stations, "apartments": apartments,
                      "_label": "테스트"}}
    out = select_boxes(scanned)
    names = [b["station"] for b in out["boxes"]]
    for i in range(70):
        assert f"역{i:02d}" in names
    for name in REQUIRED_STATIONS:
        assert name in names
