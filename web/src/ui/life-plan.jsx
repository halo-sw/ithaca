// 47j: household life-plan review card + run summary (pure, SSR-safe).
//
// LifePlanCard reviews a generated plan BEFORE confirmation: stated
// inputs vs proposed assumptions are labelled per member, schedule
// counts come from a read-only EFFECTIVE preview (validated plan
// changes applied to a scenario clone for display only — no
// confirmLifePlan/applyLifePlan call, no input mutation), and
// questions/unmodeled stay visible until resolved. LifePlanRunSummary
// renders only recorded values from summarizePlanRun() result(s): one
// direct summary or a per-home map with explicit home headers.
import React from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { lifePlanExplanation } from "../life/plan.js";
import { placeNameEn, workplaceLabel } from "./scene-chrome.js";

const L = (lang) => (lang === "ko" ? "ko" : "en");
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_KO = { Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일" };

const STR = {
  en: {
    title: "Your month, planned around your life",
    loading: "Preparing your plan…",
    stated: "You stated",
    proposal: "Proposed assumption — please review",
    base: "Base assumption",
    trace: "Trace",
    confirm: "Use this plan and simulate",
    confirmed: "Confirmed — in simulation",
    revise: "Adjust my routine",
    retry: "Retry",
    blockedNote: "Answer the questions below by revising your routine, then generate a new plan.",
    schoolNone: "School: Not confirmed",
    schoolUnresolved: "School: not confirmed — awaiting details",
    schoolLegacy: "Nearby school route — proxy, not an assigned school; enrollment not checked",
    schoolRoute: (level) => `Nearby ${level} school route — assumption; enrollment not checked`,
    workUnresolved: "Workplace not confirmed",
    workNone: "No workplace stated",
    noCommute: "No commute in this plan",
    noSchoolRoutine: "No school routine in this plan",
    questions: "Questions to resolve",
    unmodeled: "Not modelled",
    notes: "Review notes",
    windowReason: "Repeat your working days, weekends and everyday trips to see what adds up.",
    limit: "A comparison under your stated assumptions, not a forecast.",
    details: "Full assumptions and method",
    proposed: "Proposed schedule (review only — not applied)",
    provenance: "Plan proposed by Muse",
    sameWork: (label, dest) => `Same workplace as ${label}${dest ? ` (${dest})` : ""}`,
    first7: "First 7 days",
    full: "Full period",
    legs: "Recorded travel legs",
    minutes: "recorded travel",
    commuteTotal: "Commute (walk + ride + wait)",
    minUnit: "min",
    noTrips: "No recorded trips",
    observed: "observed days",
    tripsOnlyNote: "trip days only — not full-period observation",
    missingMembers: "No recorded trips for",
    unavailableDays: "days with unavailable activities",
    commuteUnknown: "Commute unavailable (no daily records)",
    partial: "partial — known subtotal",
    legNote: "Trip-leg minutes only; rail and wait are not included",
    missingMinutes: "legs without recorded minutes (not counted)",
    byMember: "By member",
    byPurpose: "By purpose",
  },
  ko: {
    title: "생활에 맞춘 한 달 플랜",
    loading: "플랜을 준비하는 중…",
    stated: "고객이 입력함",
    proposal: "제안된 가정 — 확인해 주세요",
    base: "기본 가정",
    trace: "근거",
    confirm: "이 플랜으로 살아 보기",
    confirmed: "확정됨 — 시뮬레이션에 사용 중",
    revise: "루틴 조정하기",
    retry: "다시 시도",
    blockedNote: "아래 질문을 확인하고 루틴을 조정한 뒤 새 플랜을 만들어 주세요.",
    schoolNone: "학교: 미확인",
    schoolUnresolved: "학교: 미확인 — 세부 정보 대기 중",
    schoolLegacy: "인근 학교 경로 — 프록시 가정이며, 배정 학교 아님, 배정·입학 미확인",
    schoolRoute: (level) => `인근 ${level} 학교 경로 — 가정이며, 배정·입학 미확인`,
    workUnresolved: "직장 미확인",
    workNone: "직장 정보 없음",
    noCommute: "이 플랜에서는 출퇴근 없음",
    noSchoolRoutine: "이 플랜에서는 통학 없음",
    questions: "확인할 질문",
    unmodeled: "모델에 없음",
    notes: "검토 메모",
    windowReason: "평일·주말 출근 요일과 매일의 이동을 반복해 보면 무엇이 쌓이는지 알 수 있습니다.",
    limit: "입력하신 가정에 따른 비교이며, 예측이 아닙니다.",
    details: "전체 가정과 산출 방법",
    proposed: "제안된 일정 (검토용 — 아직 적용되지 않음)",
    provenance: "Muse가 제안한 플랜",
    sameWork: (label, dest) => `${label}와 같은 직장${dest ? ` (${dest})` : ""}`,
    first7: "처음 7일",
    full: "전체 기간",
    legs: "기록된 이동 구간",
    minutes: "기록된 이동 시간",
    commuteTotal: "출퇴근 합계(도보+열차+대기)",
    minUnit: "분",
    noTrips: "기록된 이동이 없습니다",
    observed: "기록된 날",
    tripsOnlyNote: "이동 발생일 기준 — 전체 기간 관측 아님",
    missingMembers: "기록된 이동이 없는 구성원",
    unavailableDays: "이용 불가 활동이 있는 날",
    commuteUnknown: "출퇴근 미확인(일별 기록 없음)",
    partial: "부분 집계 — 확인된 합계",
    legNote: "이동 구간 분만 포함; 열차·대기 시간 제외",
    missingMinutes: "시간 미기록 구간 (합산 제외)",
    byMember: "구성원별",
    byPurpose: "목적별",
  },
};

const FIELD_LABEL = {
  en: {
    preferences: "Preferences", workdays: "Workdays", schooldays: "Schooldays",
    errands_per_week: "Weekly errands", park_walks_per_week: "Park walks per week",
    clinic_visits_per_month: "Clinic visits per month", cafe_visits_per_week: "Café visits per week",
    vet_visits_per_month: "Vet visits per month", home_office: "Home office",
    dog_walk_morning: "Morning dog walks", commute: "Commute", school: "School",
  },
  ko: {
    preferences: "선호", workdays: "출근 요일", schooldays: "등교 요일",
    errands_per_week: "주간 장보기", park_walks_per_week: "주간 공원 산책",
    clinic_visits_per_month: "월간 병원 방문", cafe_visits_per_week: "주간 카페 방문",
    vet_visits_per_month: "월간 동물병원 방문", home_office: "재택 근무",
    dog_walk_morning: "아침 산책", commute: "출퇴근", school: "통학",
  },
};

const CODE_LABEL = {
  en: {
    commute: "Commute", school: "School route", errands: "Errands", walks: "Park walks",
    remote_days: "Remote days", clinic: "Clinic visits", pet_care: "Pet care",
    monthly_cost: "Monthly spending", daily_variation: "Weekday–weekend pattern",
  },
  ko: {
    commute: "출퇴근", school: "통학 경로", errands: "장보기", walks: "공원 산책",
    remote_days: "재택일", clinic: "병원 방문", pet_care: "반려동물 돌봄",
    monthly_cost: "월 지출", daily_variation: "평일·주말 패턴",
  },
};

const PURPOSE_LABEL = {
  en: {
    commute: "Commute", school: "School", errands: "Errands", walks: "Walks",
    clinic: "Clinic", pet_care: "Pet care", remote_days: "Remote days",
    monthly_cost: "Monthly spending", daily_variation: "Weekday–weekend pattern", other: "Other",
  },
  ko: {
    commute: "출퇴근", school: "통학", errands: "장보기", walks: "산책",
    clinic: "병원", pet_care: "반려동물 돌봄", remote_days: "재택일",
    monthly_cost: "월 지출", daily_variation: "평일·주말 패턴", other: "기타",
  },
};

const MODE_LABEL = {
  en: {
    station_ride: "station ride", office: "office", remote: "remote work",
    walk: "walk", bike: "bike", none: "no travel",
  },
  ko: {
    station_ride: "역 이용 출퇴근", office: "사무실 출근", remote: "원격 근무",
    walk: "도보 출퇴근", bike: "자전거 출퇴근", none: "이동 없음",
  },
};

const LEVEL_LABEL = {
  en: { elementary: "elementary", middle: "middle", high: "high", unknown: "unknown" },
  ko: { elementary: "초등", middle: "중등", high: "고등", unknown: "미정" },
};

function fieldLabel(field, lang) {
  return (FIELD_LABEL[lang] && FIELD_LABEL[lang][field]) || field;
}

function codeLabel(code, lang) {
  return (CODE_LABEL[lang] && CODE_LABEL[lang][code]) || code;
}

function purposeLabel(purpose, lang) {
  return (PURPOSE_LABEL[lang] && PURPOSE_LABEL[lang][purpose]) || purpose;
}

function dayList(days, lang) {
  if (!Array.isArray(days)) return "";
  if (lang === "ko") return days.map((d) => DAY_KO[d] || d).join("·");
  return days.join(", ");
}

function isWeekdayList(v) {
  return Array.isArray(v) && v.length > 0 && v.every((d) => WEEKDAYS.includes(d));
}

function formatValue(value, lang) {
  if (value === null || value === undefined) return lang === "ko" ? "없음" : "None";
  if (typeof value === "boolean") return value ? (lang === "ko" ? "예" : "Yes") : (lang === "ko" ? "아니요" : "No");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value === "none") return lang === "ko" ? "이동 없음" : "No travel";
    return value;
  }
  if (Array.isArray(value)) {
    if (isWeekdayList(value)) return dayList(value, lang);
    return value.map((v) => formatValue(v, lang)).join(", ");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 2 && "supermarket" in value && "convenience" in value) {
      return lang === "ko"
        ? `슈퍼마켓 주 ${value.supermarket}회 · 편의점 주 ${value.convenience}회`
        : `Supermarket ${value.supermarket}/week · Convenience ${value.convenience}/week`;
    }
    return keys.map((k) => `${fieldLabel(k, lang)}: ${formatValue(value[k], lang)}`).join(" · ");
  }
  return String(value);
}

function cloneJson(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Pure review projection: validated plan changes applied to a scenario
// clone for DISPLAY ONLY. Never calls confirm/apply, never mutates the
// inputs. Commute none / member:<id> and work_unresolved match the core:
// none clears to a no-commute member; a ref copies the ORIGINAL
// scenario work of a resolved non-none member (never another patch);
// anything else leaves the member untouched for display.
export function previewEffectiveScenario(plan, input, scenario) {
  const hasMembers = !!(scenario && scenario.household && Array.isArray(scenario.household.members));
  const base = hasMembers
    ? cloneJson(scenario)
    : {
        household: { members: cloneJson((input && input.members) || []) },
        days: (scenario && scenario.days) ?? (input && input.days) ?? null,
        start_date: (scenario && scenario.start_date) ?? (input && input.start_date) ?? null,
      };
  try {
    const members = base.household.members;
    const byId = new Map(members.map((m) => [m && m.id, m]));
    const sourceWork = new Map(members.map((m) => [m && m.id, cloneJson(m && m.work)]));
    const inputById = new Map(((input && input.members) || []).map((m) => [m && m.id, m]));
    for (const entry of (plan && plan.members) || []) {
      const target = byId.get(entry && entry.id);
      if (!target) continue;
      for (const c of (entry && entry.changes) || []) {
        if (!c || typeof c.field !== "string") continue;
        if (c.field === "commute") {
          if (c.value === "none") {
            target.commute = "none";
            target.work = { type: "none" };
            target.work_unresolved = false;
          } else {
            const m = /^member:(.+)$/.exec(typeof c.value === "string" ? c.value : "");
            const ref = m && (byId.get(m[1]) || inputById.get(m[1]));
            const w = ref && ref.work;
            if (ref && w && typeof w === "object" && typeof w.type === "string" && w.type !== "none" && ref.work_unresolved !== true) {
              const src = sourceWork.get(m[1]);
              target.work = cloneJson(src !== undefined ? src : w);
              delete target.commute;
              target.work_unresolved = false;
            }
          }
        } else {
          target[c.field] = cloneJson(c.value);
        }
      }
    }
  } catch {
    // Display-only: never throw; show the base clone as-is.
  }
  return base;
}

function pickName(v) {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (v && typeof v === "object" && typeof v.name === "string" && v.name.trim()) return v.name.trim();
  return null;
}

function stationOf(work) {
  if (!work || typeof work !== "object") return null;
  if (typeof work.station === "string" && work.station.trim()) return work.station.trim();
  if (typeof work.destination_station === "string" && work.destination_station.trim()) return work.destination_station.trim();
  if (work.place && typeof work.place.station === "string" && work.place.station.trim()) return work.place.station.trim();
  return null;
}

function workDestination(work) {
  if (!work || typeof work !== "object") return null;
  const station = stationOf(work);
  if (station) return station;
  return pickName(work.place) || pickName(work.local_poi) || null;
}

// Human-readable workplace: station labels go through the shared
// workplace helper (localized, English via placeNameEn); known places
// show their name; mode words are localized. Never String(object).
function workReadable(work, unresolved, lang) {
  const t = STR[lang];
  if (unresolved === true) return t.workUnresolved;
  if (work === null || work === undefined) return t.workNone;
  if (typeof work === "string") {
    const s = work.trim();
    if (!s) return t.workNone;
    return lang === "en" ? placeNameEn(s) : s;
  }
  if (typeof work !== "object") return String(work);
  if (work.type === "none") return t.noCommute;
  const station = stationOf(work);
  const mode = (MODE_LABEL[lang] && MODE_LABEL[lang][work.type])
    || (typeof work.type === "string" ? work.type.replace(/_/g, " ") : null);
  if (station) {
    const dest = lang === "en"
      ? workplaceLabel(station, "en", placeNameEn(station))
      : workplaceLabel(station, "ko");
    return mode ? `${mode} · ${dest}` : dest;
  }
  const name = pickName(work.place) || pickName(work.local_poi);
  if (name) {
    const shown = lang === "en" ? placeNameEn(name) : name;
    return mode ? `${mode} · ${shown}` : shown;
  }
  return mode || t.workNone;
}

// Human-readable school: false means no school routine (null, so the
// row is omitted); unresolved is not-confirmed (never a nearby proxy);
// nearby is a localized route assumption with enrollment unchecked;
// legacy `true` is a nearby proxy of unknown level, never assigned.
function schoolReadable(school, lang) {
  const t = STR[lang];
  if (school === false) return null;
  if (school === null || school === undefined) return t.schoolNone;
  if (school === true) return t.schoolLegacy;
  if (typeof school === "string") return t.schoolRoute(school);
  if (typeof school === "object") {
    const level = (LEVEL_LABEL[lang] && LEVEL_LABEL[lang][school.level]) || school.level || (lang === "ko" ? "미정" : "unknown");
    if (school.mode === "unresolved") return t.schoolUnresolved;
    return t.schoolRoute(String(level));
  }
  return t.schoolNone;
}

function memberInput(input, id) {
  const found = (input && Array.isArray(input.members) ? input.members : []).find((m) => m && m.id === id);
  return found || null;
}

function memberName(input, eff, id) {
  const src = memberInput(input, id);
  return (src && src.label) || (eff && eff.label) || id;
}

function windowDays(plan, scenario) {
  if (scenario && Number.isInteger(scenario.days)) return scenario.days;
  if (plan && Number.isInteger(plan.days)) return plan.days;
  return 30;
}

// Display value for one validated change: commute refs resolve to the
// known member label + destination (never a raw `member:<id>`),
// school objects render as human labels, weekday lists are localized.
function changeDisplayValue(change, input, preview, lang) {
  const v = change.value;
  if (change.field === "commute") {
    if (v === "none") return lang === "ko" ? "출근 없음" : "No commute";
    const m = /^member:(.+)$/.exec(typeof v === "string" ? v : "");
    if (m) {
      const ref = memberInput(input, m[1]);
      const label = (ref && ref.label) || m[1];
      const dest = workDestination(ref && ref.work);
      const shown = dest && lang === "en" ? placeNameEn(dest) : dest;
      return STR[lang].sameWork(label, shown);
    }
    return formatValue(v, lang);
  }
  if (change.field === "school") {
    return schoolReadable(v, lang) || STR[lang].noSchoolRoutine;
  }
  if (change.field === "workdays" || change.field === "schooldays") {
    return dayList(v, lang);
  }
  return formatValue(v, lang);
}

// Effective display value for the full-assumptions table: the patched
// value when the plan changed the field, else the member's actual value.
function effectiveFieldValue(field, change, eff, src) {
  if (change) return change.value;
  if (eff && eff[field] !== undefined) return eff[field];
  if (src && src.assumptions && src.assumptions[field] !== undefined) return src.assumptions[field];
  return undefined;
}

function ChangeRow({ change, input, preview, lang }) {
  const t = STR[lang];
  const tag = change.basis === "stated" ? t.stated : t.proposal;
  return (
    <VStack gap={0}>
      <Text>{`${fieldLabel(change.field, lang)}: ${changeDisplayValue(change, input, preview, lang)} — ${tag}`}</Text>
      {change.evidence ? <Text type="supporting">{`${t.trace}: “${change.evidence}”`}</Text> : null}
    </VStack>
  );
}

function MemberSection({ entry, input, eff, count, lang }) {
  const t = STR[lang];
  const src = memberInput(input, entry.id);
  const name = memberName(input, eff, entry.id);
  const changes = entry.changes || [];
  const prefs = changes.filter((c) => c.field === "preferences");
  const routine = changes.filter((c) => c.field !== "preferences");
  const byField = new Map(changes.map((c) => [c.field, c]));
  const work = eff ? eff.work : src && src.work;
  const unresolved = eff ? eff.work_unresolved : src && src.work_unresolved;
  const schoolText = schoolReadable(eff ? eff.school : src && src.school, lang);
  const statedFields = (input && input.stated_fields && input.stated_fields[entry.id]) || [];
  const assumptions = (src && src.assumptions) || {};
  const keys = [...new Set([...Object.keys(assumptions), ...changes.map((c) => c.field)])];
  return (
    <VStack gap={1}>
      <Text>{lang === "ko"
        ? `${name}: 출근 ${count.work_days}일 · 등교 ${count.school_days}일`
        : `${name}: ${count.work_days} workdays · ${count.school_days} schooldays`}</Text>
      <Text type="supporting">{`${lang === "ko" ? "직장" : "Work"}: ${workReadable(work, unresolved, lang)}`}</Text>
      {schoolText !== null ? <Text type="supporting">{schoolText}</Text> : null}
      {changes.length === 0
        ? <Text type="supporting">{lang === "ko" ? "변경 없음" : "No changes"}</Text>
        : null}
      {prefs.map((c) => <ChangeRow key={`p-${c.field}`} change={c} input={input} preview={eff} lang={lang} />)}
      {routine.map((c) => <ChangeRow key={`r-${c.field}`} change={c} input={input} preview={eff} lang={lang} />)}
      {keys.length > 0 ? (
        <details>
          <summary>{t.details}</summary>
          <table>
            <tbody>
              {keys.map((k) => {
                const change = byField.get(k) || null;
                const basis = change ? (change.basis === "stated" ? t.stated : t.proposal)
                  : (statedFields.includes(k) ? t.stated : t.base);
                const shown = k === "commute" && change
                  ? changeDisplayValue(change, input, eff, lang)
                  : k === "school"
                    ? (schoolReadable(effectiveFieldValue(k, change, eff, src), lang) || t.noSchoolRoutine)
                    : (k === "workdays" || k === "schooldays")
                      ? dayList(effectiveFieldValue(k, change, eff, src), lang)
                      : formatValue(effectiveFieldValue(k, change, eff, src), lang);
                return (
                  <tr key={k}>
                    <th scope="row">{fieldLabel(k, lang)}</th>
                    <td>{`${shown} — ${basis}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      ) : null}
    </VStack>
  );
}

// Review a generated household plan before confirmation. Read-only:
// the effective preview clones the scenario for display (never confirm,
// apply, or input mutation). Schedule counts come from the EFFECTIVE
// preview, shown even while questions block confirmation.
export function LifePlanCard({ plan, input, scenario, lang = "en", onConfirm, onRevise, onRetry, busy = false, confirmed = false, error = null }) {
  const lg = L(lang);
  const t = STR[lg];
  if (!plan) {
    return (
      <VStack gap={2}>
        <Text>{t.title}</Text>
        {busy ? <Text>{t.loading}</Text> : null}
        {error ? (
          <VStack gap={1}>
            <Text>{String((error && error.message) || error)}</Text>
            {onRetry ? <Button size="sm" variant="secondary" label={t.retry} onClick={onRetry} /> : null}
          </VStack>
        ) : null}
      </VStack>
    );
  }
  const blocked = Array.isArray(plan.questions) && plan.questions.length > 0;
  const days = windowDays(plan, scenario);
  const start = (scenario && typeof scenario.start_date === "string" && scenario.start_date)
    || (typeof plan.start_date === "string" && plan.start_date) || null;
  const preview = previewEffectiveScenario(plan, input, scenario || {});
  const effScenario = { ...(scenario || {}), household: preview.household, days, start_date: start };
  let explain = null;
  try {
    explain = lifePlanExplanation(plan, effScenario, lg);
  } catch {
    explain = null;
  }
  const counts = explain && Array.isArray(explain.members) ? explain.members : [];
  const countById = new Map(counts.map((c) => [c.id, c]));
  const effById = new Map((preview.household.members || []).map((m) => [m && m.id, m]));
  const synopsis = counts.map((c) => {
    const label = memberName(input, effById.get(c.id), c.id);
    return lg === "ko"
      ? `${label} 출근 ${c.work_days}일 · 등교 ${c.school_days}일`
      : `${label}: ${c.work_days} workdays · ${c.school_days} schooldays`;
  }).join(lg === "ko" ? " / " : " / ");
  const windowLine = lg === "ko"
    ? `${start || "미정"}부터 ${days}일`
    : `From ${start || "unknown start"} for ${days} days`;
  const observations = Array.isArray(plan.observations) ? plan.observations : [];
  return (
    <VStack gap={2}>
      <Text>{t.title}</Text>
      <Text type="supporting">{t.windowReason}</Text>
      <Text type="supporting">{windowLine}</Text>
      <Text>{t.proposed}</Text>
      {counts.length > 0 ? <Text type="supporting">{synopsis}</Text> : null}
      <Text>{t.limit}</Text>
      {(plan.members || []).map((entry) => (
        <MemberSection
          key={entry.id}
          entry={entry}
          input={input}
          eff={effById.get(entry.id) || null}
          count={countById.get(entry.id) || { work_days: 0, school_days: 0 }}
          lang={lg}
        />
      ))}
      {observations.length > 0 ? (
        <VStack gap={1}>
          {observations.map((o, i) => (
            <Text key={i} type="supporting">{`${codeLabel(o.code, lg)}: ${o.reason}`}</Text>
          ))}
        </VStack>
      ) : null}
      {blocked ? (
        <VStack gap={1}>
          <Text>{t.questions}</Text>
          {(plan.questions || []).map((q, i) => <Text key={i}>{q}</Text>)}
          <Text type="supporting">{t.blockedNote}</Text>
        </VStack>
      ) : null}
      {Array.isArray(plan.unmodeled) && plan.unmodeled.length > 0 ? (
        <VStack gap={1}>
          <Text>{t.unmodeled}</Text>
          {plan.unmodeled.map((u, i) => <Text key={i} type="supporting">{u}</Text>)}
        </VStack>
      ) : null}
      {Array.isArray(plan.review) && plan.review.length > 0 ? (
        <VStack gap={1}>
          <Text>{t.notes}</Text>
          {plan.review.map((r, i) => <Text key={i} type="supporting">{r}</Text>)}
        </VStack>
      ) : null}
      {explain ? (
        <details>
          <summary>{t.details}</summary>
          <VStack gap={1}>
            {(explain.methods || []).map((m) => (
              <Text key={m.code} type="supporting">{`${codeLabel(m.code, lg)}: ${m.text}`}</Text>
            ))}
            <Text type="supporting">{explain.limitation}</Text>
          </VStack>
        </details>
      ) : null}
      {plan.source === "muse" ? <Text type="supporting">{t.provenance}</Text> : null}
      {error && !confirmed ? (
        <VStack gap={1}>
          <Text>{String((error && error.message) || error)}</Text>
          {onRetry ? <Button size="sm" variant="secondary" label={t.retry} onClick={onRetry} /> : null}
        </VStack>
      ) : null}
      {confirmed ? (
        <Text>{t.confirmed}</Text>
      ) : (
        <HStack gap={1} vAlign="center" wrap="wrap">
          <Button size="sm" variant="primary" label={t.confirm} disabled={blocked || busy} onClick={() => onConfirm && onConfirm()} data-testid="life-plan-confirm" />
          {onRevise ? <Button size="sm" variant="secondary" label={t.revise} onClick={() => onRevise()} data-testid="life-plan-revise" /> : null}
        </HStack>
      )}
    </VStack>
  );
}

function minutesLine(value, partial, unit, partialWord) {
  if (typeof value === "number") return `${value} ${unit}${partial ? ` (${partialWord})` : ""}`;
  return null;
}

function WindowBlock({ title, data, missing, memberName, lang }) {
  const t = STR[lang];
  const trips = data && Number.isInteger(data.trips) ? data.trips : 0;
  const travel = typeof data.travel_minutes === "number" ? data.travel_minutes : 0;
  const travelPartial = !!(data && data.travel_minutes_partial);
  const commute = data && typeof data.commute_minutes === "number" ? data.commute_minutes : null;
  const commutePartial = !!(data && data.commute_minutes_partial);
  const travelText = minutesLine(travel, travelPartial, t.minUnit, t.partial);
  const commuteText = minutesLine(commute, commutePartial, t.minUnit, t.partial);
  const byMember = (data && data.by_member) || {};
  const byPurpose = (data && data.by_purpose) || {};
  return (
    <VStack gap={1}>
      <Text>{title}</Text>
      {trips === 0 ? <Text>{t.noTrips}</Text> : null}
      <Text>{`${t.legs}: ${trips}`}</Text>
      {travelText !== null ? <Text>{`${t.minutes}: ${travelText}`}</Text> : null}
      <Text type="supporting">{t.legNote}</Text>
      {commuteText !== null
        ? <Text>{`${t.commuteTotal}: ${commuteText}`}</Text>
        : <Text type="supporting">{t.commuteUnknown}</Text>}
      {Object.keys(byMember).length > 0 ? <Text type="supporting">{t.byMember}</Text> : null}
      {Object.keys(byMember).sort().map((id) => {
        const m = byMember[id] || {};
        const mt = typeof m.travel_minutes === "number" ? m.travel_minutes : 0;
        const mtText = minutesLine(mt, !!m.travel_minutes_partial, t.minUnit, t.partial);
        const mc = typeof m.commute_minutes === "number"
          ? minutesLine(m.commute_minutes, !!m.commute_minutes_partial, t.minUnit, t.partial) : null;
        return (
          <Text key={id} type="supporting">
            {`${memberName(id)}: ${m.trips || 0} · ${mtText}${mc !== null ? ` · ${t.commuteTotal} ${mc}` : ""}`}
          </Text>
        );
      })}
      {Object.keys(byPurpose).length > 0 ? <Text type="supporting">{t.byPurpose}</Text> : null}
      {Object.keys(byPurpose).sort().map((p) => (
        <Text key={p} type="supporting">{`${purposeLabel(p, lang)}: ${byPurpose[p].trips || 0}`}</Text>
      ))}
      {missing && missing.legs_missing_minutes > 0 ? (
        <Text type="supporting">{`${missing.legs_missing_minutes} ${t.missingMinutes}`}</Text>
      ) : null}
    </VStack>
  );
}

function coverageLine(summary, lang) {
  const t = STR[lang];
  const cov = summary && summary.day_coverage;
  if (!cov) return null;
  const total = Number.isInteger(cov.total_days) ? cov.total_days : 0;
  const observed = Number.isInteger(cov.observed_days) ? cov.observed_days : 0;
  if (cov.coverage_source === "trips_only") {
    return `${observed}/${total} ${t.observed} (${t.tripsOnlyNote})`;
  }
  return `${observed}/${total} ${t.observed}`;
}

// Render recorded values only: one direct summarizePlanRun() summary,
// or a per-home map ({A: summary, B: summary}) with explicit home
// headers. `labels` is either a member map ({id: name}) for a direct
// summary or a home-label array (["A", "B"]) for a map; member names
// then resolve from the optional `input`, never invented. `travel_*`
// is recorded trip-leg minutes (walking/cycling — rail and wait are
// not included); `commute_*` is the separate daily-engine door-to-door
// total (walk+ride+wait) when available, otherwise unavailable —
// never zero-filled. Partial totals are labelled, never complete.
export function LifePlanRunSummary({ summaries, labels, lang = "en", input = null }) {
  const lg = L(lang);
  const t = STR[lg];
  if (!summaries) return <Text type="supporting">{t.noTrips}</Text>;
  if (summaries.first_7_days || summaries.full_period) {
    return <SingleSummary summary={summaries} labels={labels} lang={lg} input={input} />;
  }
  const keys = Object.keys(summaries).sort();
  if (keys.length === 0) return <Text type="supporting">{t.noTrips}</Text>;
  const homeNames = Array.isArray(labels) ? labels : null;
  return (
    <VStack gap={2}>
      {keys.map((k, i) => (
        <VStack gap={1} key={k}>
          <Text>{(homeNames && homeNames[i]) || k}</Text>
          <SingleSummary summary={summaries[k]} labels={homeNames ? null : labels} lang={lg} input={input} />
        </VStack>
      ))}
    </VStack>
  );
}

function SingleSummary({ summary, labels, lang, input }) {
  const t = STR[lang];
  if (!summary) return <Text type="supporting">{t.noTrips}</Text>;
  const missing = summary.missing || {};
  const nameFor = (id) => {
    if (labels && !Array.isArray(labels) && labels[id]) return labels[id];
    const found = memberInput(input, id);
    if (found && found.label) return found.label;
    return id;
  };
  const noTripIds = Array.isArray(missing.members_without_trips) ? missing.members_without_trips : [];
  const cov = coverageLine(summary, lang);
  return (
    <VStack gap={2}>
      <WindowBlock title={t.first7} data={summary.first_7_days} missing={missing} memberName={nameFor} lang={lang} />
      <WindowBlock title={t.full} data={summary.full_period} missing={missing} memberName={nameFor} lang={lang} />
      {cov ? (
        <Text type="supporting">{cov}</Text>
      ) : null}
      {noTripIds.length > 0 ? (
        <Text type="supporting">
          {`${t.missingMembers}: ${noTripIds.map((id) => nameFor(id)).join(", ")}`}
        </Text>
      ) : null}
      {Number.isInteger(missing.unavailable_days) && missing.unavailable_days > 0 ? (
        <Text type="supporting">{`${missing.unavailable_days} ${t.unavailableDays}`}</Text>
      ) : null}
    </VStack>
  );
}
