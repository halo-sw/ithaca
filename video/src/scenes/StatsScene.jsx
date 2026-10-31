import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import stats from "../../data/stats.json";
import { fillLine, fillLines, fillTable } from "../copy.js";
import { appearOpacity, riseOffset, sceneOpacity } from "../fade.js";
import { COLORS, FONT_FAMILY, TYPE } from "../theme.js";

// The caption as a heading, then either the model table (`table_en`, two
// columns: bold label + text) or the rows (`rows_en`) as large lines with a
// thin accent bar. Rows dropped by copy.js are filtered first, so they
// leave no gap.
export function StatsScene({ scene, durationInFrames }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const heading = fillLine(scene.caption_en, stats);
  const rows = fillLines(scene.rows_en, stats);
  const table = fillTable(scene.table_en, stats);
  const padX = 192;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.page,
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: padX,
          right: padX,
          top: 180,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {heading ? (
          <div
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.subtitle,
              fontWeight: 700,
              lineHeight: 1.3,
              color: COLORS.ink,
              opacity: appearOpacity(frame, 0),
              transform: `translateY(${riseOffset(frame, 0)}px)`,
            }}
          >
            {heading}
          </div>
        ) : null}
        {table.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 48,
              rowGap: 28,
              marginTop: 48,
              maxWidth: width - padX * 2,
            }}
          >
            {table.map(([label, text], i) => {
              const appearFrame = i * fps;
              const anim = {
                opacity: appearOpacity(frame, appearFrame),
                transform: `translateY(${riseOffset(frame, appearFrame)}px)`,
              };
              return (
                <React.Fragment key={i}>
                  <div
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: TYPE.subtitle,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: COLORS.ink,
                      ...anim,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: TYPE.caption,
                      lineHeight: 1.35,
                      color: COLORS.ink2,
                      ...anim,
                    }}
                  >
                    {text}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 36,
              marginTop: 48,
              maxWidth: width - padX * 2,
            }}
          >
            {rows.map((text, i) => {
              const appearFrame = i * fps;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "stretch",
                    opacity: appearOpacity(frame, appearFrame),
                    transform: `translateY(${riseOffset(frame, appearFrame)}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      flex: "none",
                      backgroundColor: COLORS.accent,
                      borderRadius: 3,
                      marginRight: 24,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: TYPE.subtitle,
                      fontWeight: 400,
                      lineHeight: 1.35,
                      color: COLORS.ink,
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
