import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Injects the Pretendard @font-face (file copied from
// web/public/fonts/pretendard/ under the OFL) and blocks rendering until the
// font is ready, so no frame ever shows a fallback font.
export function useFonts() {
  const [handle] = useState(() => delayRender("waiting for Pretendard"));

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    // Safety net so a failed font fetch can never hang the render forever.
    const timeout = setTimeout(finish, 10000);
    try {
      const url = staticFile("fonts/pretendard/PretendardVariable.woff2");
      const style = document.createElement("style");
      style.setAttribute("data-video-font", "pretendard");
      style.textContent =
        "@font-face { font-family: 'Pretendard Variable'; " +
        "font-weight: 45 920; font-style: normal; font-display: swap; " +
        `src: url('${url}') format('woff2-variations'); }`;
      document.head.appendChild(style);
      const wanted = [
        document.fonts.load('400 72px "Pretendard Variable"', " pretent"),
        document.fonts.load('600 72px "Pretendard Variable"', " pretent"),
        document.fonts.load('700 72px "Pretendard Variable"', " pretent"),
        document.fonts.load('400 72px "Pretendard Variable"', "한글자막"),
      ];
      Promise.all(wanted)
        .then(() => document.fonts.ready)
        .then(finish)
        .catch(finish);
    } catch (_err) {
      finish();
    }
    return () => clearTimeout(timeout);
  }, [handle]);
}
