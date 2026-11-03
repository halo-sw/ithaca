# Stage 60c2 — diary picture: fixed scenes on the server, one button under the diary (brief for Muse)

Agent mode, rules in `AGENTS.md` ("Usage budget"). Sandbox: no network, no keys. No sub-agents, no git, no todo list, no full suite, no build. First edit in your first tool call. Read only the lines named here. Stop when done.

## Why
60c1 sends a free `sentence` from the browser into the image prompt, so anyone could make our key draw any text.

The server will now build the prompt itself from a **fixed scene list**. The browser sends only:
- a scene kind;
- the minute of the day;
- the region.

No customer text reaches the model.

## 1. Server — `web/src/consult/diary-image.js` (read the whole file once)
1. **Remove** `IMAGE_SENTENCE_MAX`, `sceneSentence` and the sentence path. **Keep** `IMAGE_MODEL`, `IMAGE_URL`, `IMAGE_PROMPT_PREFIX`, the key, timeout and upstream handling, and every response shape not named here.
2. **Add exports:**
   ```js
   export const SCENE_KINDS = ["commute", "errand", "park", "ride", "plan"];
   export const SCENES = {
     commute: { kr: "a figure seen from behind walking to a subway entrance on a Korean apartment-district street",
                us: "a figure seen from behind walking to a commuter-train platform in a quiet Bay Area suburb" },
     errand:  { kr: "a figure seen from behind carrying a grocery bag out of a small neighbourhood mart in a Korean city",
                us: "a figure seen from behind carrying a grocery bag out of a neighbourhood market in a Bay Area suburb" },
     park:    { kr: "a figure seen from behind walking on a path in a small park between Korean apartment blocks",
                us: "a figure seen from behind walking on a path in a leafy Bay Area neighbourhood park" },
     ride:    { kr: "the inside of a busy subway car in a Korean city, passengers seen from behind",
                us: "the inside of a commuter-train carriage on the San Francisco Peninsula, passengers seen from behind" },
     plan:    { kr: "a quiet weekend morning inside a small Korean apartment, sunlight on the floor",
                us: "a quiet weekend morning inside a small Bay Area apartment, sunlight on the floor" },
   };
   ```
3. **`lightFor(minute)`.** Take the minute modulo 1440, then:
   - `< 360` → `"before dawn, deep blue sky"`;
   - `< 660` → `"soft morning light"`;
   - `< 1020` → `"bright afternoon light"`;
   - `< 1200` → `"early evening, sunset glow"`;
   - otherwise `"night, warm street lights"`.
4. **`scenePrompt({ kind, minute, region })`** = `IMAGE_PROMPT_PREFIX + SCENES[kind][region] + ", " + lightFor(minute)`.
5. **The handler** reads a JSON body of at most 1 KB, `{ kind, minute, region }`:
   - bad JSON → 400 `bad_request`;
   - `kind` not in `SCENE_KINDS`, `minute` not a finite number in `[0, 1440)`, or `region` not `"kr"` or `"us"` → 400 `bad_scene`;
   - otherwise the upstream `prompt` is `scenePrompt(...)`.
   - It ignores any other field, including `sentence`, and never echoes the prompt.

## 2. Client helpers — new `web/src/ui/diary-picture.js` (no React)
- **Flag.** Write it exactly like this, so it is `false` under node:
  ```js
  export const MUSE_IMAGE_ENABLED =
    typeof import.meta !== "undefined" && !!import.meta.env && import.meta.env.VITE_MUSE_IMAGE === "1";
  ```
- **Caption.** `export const DIARY_PICTURE_CAPTION = "Muse Image 일러스트 · 실제 장소 사진이 아니에요";`
- **`export function sceneKindOf(line)`**, from `line.id`:
  - ends with `:errand`, `:park` or `:ride` → that word;
  - contains `weekend_plan` → `"plan"`;
  - matches `/^t\d+$/` → `"commute"`;
  - otherwise `null`.
- **`export function regionOf(compare)`** → `"us"` when `String(compare?.home_a?.area || "")` starts with `us-`, else `"kr"`.
- **`export async function postDiaryPictureWith(fetchImpl, url, body)`** never throws:
  - network error → `{ ok: false, error: "network" }`;
  - non-JSON → `{ ok: false, error: "upstream" }`;
  - `Content-Type: application/json`.
- **`export function postDiaryPicture(body)`**:
  - `LIVE_API` false → `{ ok: false, error: "offline" }`;
  - else `postDiaryPictureWith(fetch, apiUrl("/api/image/diary"), body)`;
  - import from `../paths.js` like `web/src/ui/voice.js:5`.
- **`export function diaryPictureOff()` and `setDiaryPictureOff()`**:
  - `sessionStorage` key `ithaca.diaryPicture.off`;
  - every access in try/catch;
  - `diaryPictureOff()` returns `false` when storage is missing.

## 3. `DiarySection` in `web/src/ui/chat.jsx` (`:777-822`, read once; also `:1505-1508`)
1. **New prop `region = "kr"`.** At `:1507`, pass `region={regionOf(data.compare)}`.
2. **Show the block** only when all of these hold:
   - `MUSE_IMAGE_ENABLED`;
   - `!diaryPictureOff()`, read once into state;
   - at least one line has a non-null `sceneKindOf`.
3. **Place it** after the existing `<Text type="supporting">{diaryCheckLine(diary.check)}</Text>`:
   - `<HStack gap={2} vAlign="center" wrap="wrap">` with one `<Button size="sm" variant="secondary">`.
   - Its label is `"장면 하나 그림으로 보기"` before the first picture and `"다음 장면 그림으로 보기"` after.
   - Each click takes the next line, in `lines` order, whose `sceneKindOf` is not null, wrapping around.
   - It posts `{ kind, minute: Math.round(line.minute), region }`.
   - The button is `isDisabled` while drawing.
4. **While drawing:** `<Text type="supporting">Muse Image가 그리는 중…</Text>`.
5. **Done:**
   ```jsx
   <figure style={{ margin: 0, maxWidth: 360 }}>
     <img src={image} alt="일기 장면 일러스트" style={{ width: "100%", display: "block", borderRadius: 8 }} />
     <figcaption>
       <Text type="supporting">{`${line.day + 1}일째 ${hhmm(line.minute)} 장면`}</Text>
       <Text type="supporting">{DIARY_PICTURE_CAPTION}</Text>
     </figcaption>
   </figure>
   ```
6. **Any error:**
   - call `setDiaryPictureOff()`;
   - hide the whole block for this session;
   - leave the diary itself unchanged.
7. **Nothing else.** The rows, the 모두 보기 button and the check line stay exactly as they are.

## 4. Tests
**Rewrite `web/tests/diary-image-60c.test.js`.** Keep its relay helpers and the 405 and 429 relay tests, with the bodies changed to the new shape. Cover:
- `scenePrompt` for every kind and both regions:
  - it starts with `IMAGE_PROMPT_PREFIX`;
  - it contains no digit.
- `lightFor`: 0, 480, 900, 1100 and 1300 give the five phrases in order.
- **Handler, with a fake `fetchImpl` as before:**
  - `{ kind: "park", minute: 1127, region: "kr" }` → 200 and a `data:image/webp;base64,` image;
  - the upstream `prompt` equals `scenePrompt` of that body;
  - the response has no `prompt` key.
- **Handler errors:**
  - kind `"selfie"` → 400 `bad_scene`;
  - minute `1440` → 400;
  - minute `"x"` → 400;
  - region `"jp"` → 400;
  - a body with a `sentence` that says anything does not change the prompt;
  - no key → 503;
  - fetch throws → 502;
  - upstream 429 → 502 with `status` 429.

**New `web/tests/diary-picture-60c2.test.js`:**
- `sceneKindOf` on these ids:
  - `"t000083"` → commute;
  - `"away:h1:15:1129:errand"` → errand;
  - `"away:h2:3:489:ride"` → ride;
  - `"h2:d27:0600:weekend_plan:00"` → plan;
  - `"x:y"` → null.
- `regionOf`:
  - `{ home_a: { area: "us-menlo" } }` → us;
  - `{}` → kr.
- `postDiaryPictureWith`:
  - a throwing fetch → network;
  - bad JSON → upstream;
  - the JSON header is set.
- `MUSE_IMAGE_ENABLED === false` under node.
- **Source checks on `chat.jsx`:**
  - contains `MUSE_IMAGE_ENABLED &&` or `MUSE_IMAGE_ENABLED ?`;
  - contains `DIARY_PICTURE_CAPTION`, `장면 하나 그림으로 보기`, `setDiaryPictureOff()` and `region={regionOf(data.compare)}`.

Run only: `cd web && node --test tests/diary-image-60c.test.js tests/diary-picture-60c2.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok" | head`.
If it still fails after 2 fix attempts, stop and print the failure's last lines.

## Do not touch
`relay/*` (the route stays as is), `web/src/consult/windows.js`, `web/src/ui/listings.jsx`, `web/src/i18n/*`, `web/src/ui/chatmap.jsx`, `web/src/basemap.js`, `web/src/engine/*`, other test files.

## Final message
Changed files, one line each, then the new Korean strings, one per line.
