"""Stage 38b: lines 1/4/6/gyeongui/arex/uisinseol/sillim join the network."""
from pipeline.network import SKIP_PATTERN_WORDS, _line_of_relation


def spec_of(name, route="subway"):
    spec = _line_of_relation({"type": "route", "route": route, "name": name})
    return spec["id"] if spec else None


def test_38b_new_line_mapping():
    assert spec_of("수도권 전철 1호선: 광운대 → 신창") == "line1"
    assert spec_of("수도권 전철 1호선 경인·경원 계통: 의정부 → 인천") == "line1"
    assert spec_of("인천 도시철도 1호선: 검단호수공원 → 송도달빛축제공원") is None
    assert spec_of("부산 도시철도 4호선 (미남방향)") is None
    assert spec_of("서울 지하철 6호선: 신내 → 응암순환") == "line6"
    assert spec_of("경의·중앙선: 문산 → 용문") == "gyeongui"
    assert spec_of("인천국제공항철도 일반열차: 서울역 → 인천공항2터미널") == "arex"
    assert spec_of("우이신설선: 북한산우이 → 신설동", route="light_rail") == "uisinseol"
    assert spec_of("서울 경전철 신림선: 관악산 → 샛강", route="light_rail") == "sillim"
    # Unchanged incumbents (신분당선 still wins over 분당선).
    assert spec_of("신분당선: 신사 → 광교") == "sinbundang"
    assert spec_of("수인·분당선: 청량리 → 고색") == "bundang"


def test_38b_skip_words():
    for name in ("수도권 전철 1호선: 동인천 → 용산 특급",
                 "인천국제공항철도 직통열차: 서울역 → 인천공항2터미널",
                 "경의·중앙선 셔틀: 도라산 → 임진강"):
        assert any(w in name for w in SKIP_PATTERN_WORDS), name
