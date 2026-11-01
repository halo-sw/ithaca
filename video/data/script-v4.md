# Demo video v4 — final (3:00 or less)

One sentence to leave with the judges: **"An AI family lives there for 30 days first and tells you what the listing doesn't."**

Rules (official guide): 3 minutes or less, only features built during the hackathon, a YouTube link that plays on click. The final five teams are ranked on this video.

Order the owner asked for (2026-11-02): show the real product working, **Korea first**, then say we also built the **Meta HQ** case.

- Narration: English. Synthetic voice (Kokoro `am_michael`) until the owner records their own; the timing is set so a human read of about 2:50 fits.
- Story uses only the name "Halo": no career, no area, no homes actually being viewed.
- Every number in the words comes from the recording it sits on. `[ ]` = fill from the new recording, or drop the line.
- Listing text on screen is marked "example listing text".
- Screen recording: 1920×1080, browser zoom 125 % (viewport 1536×864 at device scale 1.25), notifications off, production build after 41a–41f.

| Time | Section | Screen | Narration (EN) | 뜻 (KO) |
|---|---|---|---|---|
| 0:00–0:08 | Opening | Ithaca arch logo + title | "A house viewing gives you thirty minutes. The decision stays with you for years." | 집 구경은 30분인데, 그 결정은 몇 년을 따라와요. |
| 0:08–0:30 | My story | Title card, soft 3D neighbourhood still | "I'm Halo. My partner and I are looking for our first home. Every listing looked fine in the photos. But I kept wondering: how long is the walk home at night? Is the morning train full? What does a month really cost? I could look at a home for thirty minutes. I couldn't live in it before I signed." | 저는 Halo예요. 짝꿍과 첫 집을 찾고 있어요. 사진으로는 다 괜찮아 보였지만, 밤에 집까지 몇 분 걷는지, 아침 열차가 붐비는지, 한 달에 실제로 얼마 드는지 궁금했어요. 30분은 볼 수 있어도, 계약 전에 살아 볼 수는 없었어요. |
| 0:30–0:40 | Problem | Statistic card | "In Korea, about three in four victims of deposit fraud are in their twenties and thirties. The people with the least experience carry the biggest risk." | 한국 전세사기 피해자 4명 중 3명이 20·30대예요. 경험이 가장 적은 사람이 가장 큰 위험을 져요. |
| 0:40–0:52 | Idea | 3D neighbourhood, a person leaves home | "So before you sign, an AI household lives thirty days in each home." | 그래서 계약 전에, AI 가족이 집마다 30일을 먼저 살아요. |
| 0:52–1:12 | Demo ① Korea | Typed/voice ask → candidates on the map | "Here a couple working in [Pangyo] says it in plain words. Muse Spark reads it and calls real tools: real transactions, real prices in won, and the door-to-door commute for each home." | 판교에서 일하는 커플이 평소 말로 상황을 말해요. Muse Spark가 실제 도구를 불러 실거래가, 원 단위 가격, 집마다 출퇴근 시간을 찾아요. |
| 1:12–1:37 | Demo ② Living it | 3D follows the commute, then Muse's choices and reasons | "Pick two homes, and the household lives the same month in both. Muse decides each day: leave now or later, walk or ride, the park or the store, and says why. The engine counts every minute and every won." | 두 집을 고르면 같은 가족이 두 집에서 같은 한 달을 살아요. 언제 나갈지, 걸을지 탈지, 공원인지 마트인지 Muse가 매일 정하고 이유를 남겨요. 시간과 돈은 엔진이 1분, 1원까지 세요. |
| 1:37–2:00 | Demo ③ What the listing doesn't say | Example listing text vs "Only living there tells you" | "The listing says '[example: 5 minutes to the station]'. Living there showed [ ] evenings walking home after dark and a commute of [ ] minutes. Ithaca never picks for you. It shows you, and you decide." | 매물 글엔 '역까지 5분'이라고 쓰여 있어요(예시). 살아 보니 해 진 뒤 걸어서 귀가한 날이 [ ]번, 출퇴근은 [ ]분이었어요. Ithaca는 대신 고르지 않아요. 보여 주고, 결정은 당신이 해요. |
| 2:00–2:15 | Why trust it | Verification timeline: rejected → passed | "Before you see the report, code re-checks every number, and a separate Muse judge rejects any sentence the record does not support." | 리포트를 보기 전에 코드가 숫자를 다시 계산하고, 따로 있는 Muse 심판이 기록에 근거가 없는 문장을 반려해요. |
| 2:15–2:35 | Meta HQ + Built with Meta | Meta HQ in Menlo Park: Caltrain, ZIP rent, 3D; header model switch; briefs/ | "We also built it for Meta HQ in Menlo Park: Caltrain timetables, ZIP-level rent, the same thirty days. Switch the model to Muse Spark Open, the open-weights model, and the same month runs again. Muse Spark talks and decides, Muse Code wrote every line of product code, starting October twenty-eighth." | 멘로파크 Meta 본사 케이스도 만들었어요. Caltrain 시간표, 우편번호 단위 월세, 같은 30일이에요. 모델을 오픈 웨이트 Muse Spark Open으로 바꾸면 같은 한 달을 다시 돌려요. 대화와 결정은 Muse Spark, 제품 코드는 10월 28일부터 Muse Code가 전부 썼어요. |
| 2:35–2:47 | Real users | (dropped: no user test yet) | — | 친구 테스트를 하지 않았으니 이 장면은 빼요. |
| 2:35–2:50 | Close | End card + link | "We're still looking for our home. This time, we'll live there first." | 우리는 아직 집을 찾고 있어요. 이번엔 먼저 살아 볼 거예요. |

## Before recording
- 41a–41f merged and deployed: won as "170,000,000 won", no public rental, model switch live, server key once per IP.
- New recordings: Korea (Seoul couple, English UI), Meta HQ live run on Muse Spark Open, the verification timeline.
- After uploading to YouTube as unlisted (the owner's account), check it plays while logged out, then use the same link in the README, the submission form and the X post.
