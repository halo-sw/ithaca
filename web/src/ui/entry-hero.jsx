// 42g: one entry screen. The landing hero (eyebrow → coverage line,
// including the 바로 해 보기 card and the collapsed key row) lives here
// once; the landing page and the chat empty state both render it. On the
// landing the buttons navigate; inside the chat the same content acts in
// place through onAction (same ids as the old chat starters).
import { useState } from "react";
import { ChatComposer } from "@astryxdesign/core/Chat";
import { Text } from "@astryxdesign/core/Text";
import { assetUrl } from "../paths.js";
import { COVERAGE_LINE } from "./landing.jsx";
import { PoweredByMuse, MUSE_LOGO_PATH } from "./powered-by-muse.jsx";
import { saveByoKey } from "../consult/byok.js";
import { NO_ANSWER_PROVIDERS, LANDING_KEY_ROW_LABEL } from "./no-answer-alert.js";

// Proof facts from the real walkthrough shown under the hero chips.
const PROOFS = [
  { num: "14초", rest: "후보 6곳 찾기" },
  { num: "85초", rest: "두 집 30일 살아 보기" },
  { num: "8/8", rest: "일기 문장 기록과 대조" },
];

// Action ids shared by the chips and the 바로 해 보기 buttons.
export const ENTRY_ACTION_IDS = ["find", "listing", "example", "replay", "meta", "seoul"];

// 42i: one composer placeholder — the landing hero and the chat empty
// state both show this text.
export const ENTRY_COMPOSER_PLACEHOLDER = "판교 출근, 모은 돈 1억, 4억 이하 매매로 혼자 살 집 찾아 줘";

// 42g: pure mapping of entry ids to in-chat behaviour — the same mapping
// the old chat starterAction used (exported for the no-DOM test).
export function runEntryAction(id, deps = {}) {
  const { setValue, findText, onSend, onListing, onExample, openReplay, metaText } = deps;
  if (id === "find") { if (setValue) setValue(findText); }
  else if (id === "listing") { if (onListing) onListing(); }
  else if (id === "example") { if (onExample) onExample(); }
  else if (id === "replay") { if (openReplay) openReplay(); }
  else if (id === "meta") { if (onSend) onSend(metaText); }
  else if (id === "seoul") { if (onExample) onExample(); }
}

function TryButton({ href, onClick, primary, children }) {
  const className = primary ? "ds-lp-btn ds-lp-btn--primary" : "ds-lp-btn ds-lp-btn--secondary";
  if (href != null) {
    return <a className={className} href={href}>{children}</a>;
  }
  return <button type="button" className={className} onClick={onClick}>{children}</button>;
}

export function EntryHero({
  value,
  onValueChange,
  onSubmitText,
  onAction,
  links,
  placeholder,
  sendActions = null,
  voiceNote = "",
}) {
  // 42b: collapsed key row (same sessionStorage as ModelPanel).
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyProvider, setKeyProvider] = useState("meta");
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const saveEntryKey = () => {
    let storage = null;
    try { storage = typeof sessionStorage !== "undefined" ? sessionStorage : null; } catch { storage = null; }
    if (!saveByoKey(storage, keyProvider, keyDraft)) return;
    setKeyDraft("");
    setKeySaved(true);
  };
  const submit = (text) => {
    const content = String(text || "").trim();
    if (!content) return;
    if (onSubmitText) onSubmitText(content);
  };
  const act = (id) => { if (onAction) onAction(id); };
  const hrefFor = (id) => (links ? links[id] : null);
  return (
    <header className="ds-lp-hero">
      <p className="ds-lp-heroeyebrow">
        <img src={assetUrl(MUSE_LOGO_PATH)} alt="" width={16} height={16} />
        <span data-no-i18n>Pre-simulation by Muse Agent</span>
      </p>
      <h1 className="ds-lp-title">어떤 집을 고민 중이세요?</h1>
      <p className="ds-lp-lede">Muse가 직접 확인하고, 대신 30일 살아 보고, 대화로 알려 줘요.</p>
      <div className="ds-lp-composer">
        <ChatComposer
          onSubmit={submit}
          value={value}
          onChange={onValueChange}
          placeholder={placeholder}
          sendActions={sendActions}
        />
      </div>
      {voiceNote ? (
        <Text type="supporting">{voiceNote}</Text>
      ) : null}
      <div className="ds-lp-chips">
        <button type="button" className="ds-lp-chip" onClick={() => act("find")}>
          출근지로 집 찾기
        </button>
        <button type="button" className="ds-lp-chip" onClick={() => act("listing")}>
          본 매물 붙여 넣기
        </button>
        <button type="button" className="ds-lp-chip" onClick={() => act("example")}>
          예시로 써 보기
        </button>
      </div>
      <section className="ds-lp-try" aria-label="바로 해 보기">
        <p className="ds-lp-trylabel">바로 해 보기</p>
        <div className="ds-lp-trygrid">
          <div className="ds-lp-trygroup">
            <p className="ds-lp-tryeyebrow">키 없이</p>
            <div className="ds-lp-trybtns">
              <TryButton href={hrefFor("replay")} onClick={() => act("replay")} primary>기록된 한 달 보기</TryButton>
            </div>
            <p className="ds-lp-judgecap">녹화된 30일을 재생해요</p>
          </div>
          <div className="ds-lp-trygroup">
            <p className="ds-lp-tryeyebrow"><span className="ds-lp-livedot" aria-hidden="true" />Muse 실시간</p>
            <div className="ds-lp-trybtns ds-lp-trybtns--duo">
              <TryButton href={hrefFor("meta")} onClick={() => act("meta")}>Meta 본사 출근으로 해 보기</TryButton>
              <TryButton href={hrefFor("seoul")} onClick={() => act("seoul")}>서울로 해 보기</TryButton>
            </div>
            <p className="ds-lp-judgecap">무료 체험 하루 3회 · 이후 내 키 · <button type="button" className="ds-lp-keytoggle" aria-expanded={keyOpen}
              onClick={() => setKeyOpen((v) => !v)}><span>{LANDING_KEY_ROW_LABEL}</span><span aria-hidden="true">{keyOpen ? " ▾" : " ▸"}</span></button></p>
          </div>
        </div>
        {keyOpen && (
          <div className="ds-lp-byok-form">
              <div className="ds-lp-byok-providers" role="group" aria-label="모델 선택">
                {NO_ANSWER_PROVIDERS.map((p) => (
                  <button key={p.value} type="button"
                    className={keyProvider === p.value ? "ds-lp-chip is-on" : "ds-lp-chip"}
                    aria-pressed={keyProvider === p.value}
                    onClick={() => setKeyProvider(p.value)}>{p.label}</button>
                ))}
              </div>
              <div className="ds-lp-byok-row">
                <input type="password" className="ds-lp-byok-input" placeholder="모델 키 붙여넣기"
                  value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} aria-label="모델 키" />
                <button type="button" className="ds-lp-btn ds-lp-btn--secondary" onClick={saveEntryKey}>키 저장</button>
              </div>
              <p className="ds-lp-judgecap">키는 이 탭에만 저장돼요</p>
              {keySaved && <p className="ds-lp-judgecap">키를 저장했어요. 다음 말부터 Muse가 답해요.</p>}
          </div>
        )}
        <div className="ds-lp-proof">
          {PROOFS.map((p) => (
            <span key={p.num} className="ds-lp-prooffact">
              <b>{p.num}</b>
              <span>{p.rest}</span>
            </span>
          ))}
        </div>
        <div className="ds-lp-tryfoot">
          <PoweredByMuse size="sm" />
          <p className="ds-lp-coverline">{COVERAGE_LINE}</p>
        </div>
      </section>
    </header>
  );
}
