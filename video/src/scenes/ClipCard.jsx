import React from "react";
import { Img, OffthreadVideo, staticFile } from "remotion";
import { assetStatus } from "../assets.js";
import assetManifest from "../assets.generated.json";
import { BORDER, COLORS, FONT_FAMILY, RADII, SHADOW, TYPE } from "../theme.js";

// A rounded card showing the scene clip (video / image) or, when the asset
// has not been recorded yet, a placeholder with the scene id + expected path.
// A clip shorter than its scene holds its last frame (the video element
// clamps past its end); a longer clip is cut by the surrounding Sequence.
export function ClipCard({ asset, sceneId, width, height }) {
  const status = assetStatus(asset, assetManifest.files);
  const cardStyle = {
    width,
    height,
    backgroundColor: COLORS.card,
    borderRadius: RADII.screenCard,
    boxShadow: SHADOW,
    border: status === "missing" ? `2px dashed ${COLORS.ink3}` : BORDER,
    overflow: "hidden",
    position: "relative",
    flex: "none",
  };
  if (status === "video") {
    return (
      <div style={cardStyle}>
        <OffthreadVideo
          src={staticFile(asset)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }
  if (status === "image") {
    return (
      <div style={cardStyle}>
        <Img
          src={staticFile(asset)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        ...cardStyle,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        padding: 48,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.subtitle,
          fontWeight: 600,
          color: COLORS.ink,
        }}
      >
        {sceneId}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.callout,
          color: COLORS.ink2,
          textAlign: "center",
        }}
      >
        {asset || "(no asset)"}
      </div>
    </div>
  );
}
