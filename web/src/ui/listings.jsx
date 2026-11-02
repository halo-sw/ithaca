// 매물 tab (React, Astryx): "내가 본 매물 확인하기" — the customer
// pastes the listing text they see in a real-estate app. Reading is
// instant and local (regex over the pasted text, evidence shown);
// checking runs through the consult agent (parse_listing →
// check_listing), which owns the RTMS lookups.
//
// The app never fetches or scrapes portal sites (their terms forbid it).
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Text } from "@astryxdesign/core/Text";
import { store } from "./store.js";
import { SourceBadge } from "./source-badge.jsx";
import { parseListingText, plainListingFields } from "../money/listing.js";
import { fmtWon } from "../money/format.js";

export const EXAMPLE_LISTING_TEXT = [
  "송파구 방이동 올림픽카운티 101동 5층",
  "매매 6억 2500만, 전용 56.22㎡, 관리비 15만",
].join("\n");

const DEAL_FIELD_KO = {
  deal_type: "거래", price_won: "집값", deposit_won: "보증금",
  monthly_won: "한 달 월세", area_m2: "집 크기", floor: "층",
  complex_name: "단지 이름", address: "주소",
  maintenance_won_month: "관리비",
};

function fmtField(key, value) {
  if (value === null || value === undefined) return "–";
  if (key === "area_m2") return `${value}㎡`;
  if (key === "floor") return `${value}층`;
  if (typeof value === "number") return fmtWon(value);
  return String(value);
}

function initialText() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("fill") === "example") return EXAMPLE_LISTING_TEXT;
  } catch { /* non-browser render */ }
  return "";
}

export function PasteCheck({ onAsk } = {}) {
  const [text, setText] = useState(initialText);
  const [parsed, setParsed] = useState(null);
  const [filled, setFilled] = useState({});
  const check = store.getState().listingCheck || null;

  const read = () => {
    const r = parseListingText(text);
    setParsed(r.ok ? r : { ok: false, error: r.error, fields: null, missing: [] });
    setFilled({});
  };

  const merged = () => {
    const base = plainListingFields((parsed && parsed.fields) || {});
    const out = { ...base };
    for (const [k, v] of Object.entries(filled)) {
      if (v === "" || v === null || v === undefined) continue;
      out[k] = ["price_won", "deposit_won", "monthly_won", "area_m2",
        "floor", "maintenance_won_month"].includes(k) ? Number(v) : v;
    }
    delete out.area_note;
    return out;
  };

  const askCheck = () => {
    const text = `다음 매물을 check_listing으로 확인해줘: ${JSON.stringify(merged())}`;
    if (onAsk) {
      onAsk(text);
      return;
    }
    try {
      store.act("consultSend", text);
    } catch {
      /* consult not mounted (tour boot): the agent button still shows */
    }
  };

  const liveIn = () => {
    const m = merged();
    const text = `다음 매물을 add_listing_c로 C에 추가해줘: ${JSON.stringify({
      complex: check && check.complex ? check.complex : m.complex_name,
      area: check && check.area ? check.area : undefined,
      deal_type: m.deal_type, area_m2: m.area_m2,
      price_won: m.price_won, deposit_won: m.deposit_won,
      monthly_won: m.monthly_won,
      maintenance_won_month: m.maintenance_won_month, floor: m.floor,
    })}`;
    if (onAsk) {
      onAsk(text);
      return;
    }
    try {
      store.act("consultSend", text);
    } catch { /* same as above */ }
  };

  const missingFilled = parsed && parsed.missing
    && parsed.missing.every((m) => filled[m.field] !== undefined && filled[m.field] !== "");
  return (
    <VStack gap={2}>
      <Heading level={4}>내가 본 매물 확인하기</Heading>
      <Text type="supporting">민간 매물은 직접 붙여 넣어 주세요. 앱이 다른 사이트에서 가져오지 않아요.</Text>
      <textarea className="ui-listing-paste" rows={4} value={text}
        placeholder="예: 송파구 방이동 올림픽카운티 101동 5층&#10;매매 6억 2500만, 전용 56.22㎡, 관리비 15만"
        onChange={(e) => setText(e.target.value)} aria-label="매물 글 붙여넣기" />
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button size="sm" label="읽어 보기" onClick={read} />
        <Button size="sm" variant="secondary" label="예시로 채우기"
          onClick={() => { setText(EXAMPLE_LISTING_TEXT); setParsed(null); setFilled({}); }} />
        <Button size="sm" variant="ghost" label="지우기"
          onClick={() => { setText(""); setParsed(null); setFilled({}); }} />
      </HStack>
      {parsed && !parsed.ok && <Text>{parsed.error}</Text>}
      {parsed && parsed.ok && (
        <VStack gap={1}>
          <MetadataList>
            {Object.entries(DEAL_FIELD_KO).map(([key, label]) => {
              const f = parsed.fields[key];
              const value = f && typeof f === "object" ? f.value : null;
              if (value === null || value === undefined) return null;
              return (
                <MetadataListItem key={key} label={label}>
                  <VStack gap={1}>
                    <Text hasTabularNumbers>{fmtField(key, value)}</Text>
                    <Text type="supporting">글에서 찾음: “<span data-no-i18n>{f.evidence}</span>”</Text>
                  </VStack>
                </MetadataListItem>
              );
            })}
          </MetadataList>
          {parsed.fields.area_note && (
            <Text type="supporting">{parsed.fields.area_note}</Text>
          )}
          {parsed.missing.length > 0 && (
            <VStack gap={1}>
              {parsed.missing.map((m) => (
                <HStack gap={1} vAlign="center" key={m.field}>
                  <Text type="supporting">{m.ask}</Text>
                  <input className="ui-weight" type={m.field === "complex_name" ? "text" : "number"}
                    value={filled[m.field] ?? ""}
                    onChange={(e) => setFilled({ ...filled, [m.field]: e.target.value })}
                    aria-label={m.ask} />
                </HStack>
              ))}
            </VStack>
          )}
          {parsed.missing.length === 0 && (
            <Text type="supporting">글에 있는 값만 읽었어요. 없는 값은 물어봐요.</Text>
          )}
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button size="sm" label="이 매물 확인하기" onClick={askCheck}
              isDisabled={parsed.missing.length > 0 && !missingFilled} />
          </HStack>
          <Text type="supporting">확인은 상담에서 해요 (개발 서버 + 키). 기록된 화면에서는 상담 패널을 여세요.</Text>
        </VStack>
      )}
      {check && <CheckResult check={check} onLiveIn={liveIn} />}
    </VStack>
  );
}

const POSITION_KO = { price: "집값", deposit: "보증금", monthly: "한 달 월세" };

function CheckResult({ check, onLiveIn }) {
  if (!check || check.computable === false) {
    return (
      <VStack gap={1}>
        <Heading level={4}>매물 확인 결과</Heading>
        <Text>{(check && check.note) || "확인 결과가 없어요."}</Text>
      </VStack>
    );
  }
  return (
    <VStack gap={2}>
      <Heading level={4}>매물 확인 결과</Heading>
      <HStack gap={1} vAlign="center" wrap="wrap">
        <SourceBadge source="rtms" />
        <Text type="supporting">{`${check.complex} · ${check.area_m2}㎡ (±5㎡) · ${check.match_method === "parcel+name" ? "땅+단지 이름" : "단지 이름"} ${check.parcel_rows + check.name_rows}건`}</Text>
      </HStack>
      <MetadataList>
        {Object.entries(check.positions || {}).map(([key, pos]) => (
          <MetadataListItem key={key} label={POSITION_KO[key] || "기타"}>
            {!pos.computable ? (
              <Text type="supporting">{pos.note}</Text>
            ) : (
              <VStack gap={1}>
                <Text hasTabularNumbers>{`${fmtWon(pos.asking_won)} · ${pos.band_text}`}</Text>
                <Text type="supporting" hasTabularNumbers>{pos.detail}</Text>
                <Text type="supporting" hasTabularNumbers>
                  {`한가운데 ${fmtWon(pos.median_won)} · 범위 ${fmtWon(pos.min_won)} ~ ${fmtWon(pos.max_won)} (${pos.n}건)`}
                </Text>
              </VStack>
            )}
          </MetadataListItem>
        ))}
        {check.ratio && check.ratio.computable && (
          <MetadataListItem label="보증금이 집값의 몇 %인지">
            <Text hasTabularNumbers>{`${check.ratio.ratio_pct}% (${check.ratio.band.label})`}</Text>
          </MetadataListItem>
        )}
        {check.register && (
          <MetadataListItem label="관청 자료에서 본 집 정보">
            <Text type="supporting">{`${check.register.building_count}개 동 · ${check.register.rows.length}개 항목 (자세히는 전세 점검 탭)`}</Text>
          </MetadataListItem>
        )}
      </MetadataList>
      <Text type="supporting">{check.note}</Text>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button size="sm" label="이 매물로 30일 살아 보기" onClick={onLiveIn} />
      </HStack>
    </VStack>
  );
}

export function ListingsTab({ state }) {
  const doc = state.money;
  if (!doc || doc.error) return <Text type="supporting">생활비 문서를 먼저 만드세요.</Text>;
  return (
    <VStack gap={3}>
      <PasteCheck />
    </VStack>
  );
}
