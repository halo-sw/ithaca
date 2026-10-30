// Pure placeholder decision: is a scene asset a video, an image, or missing?
// `files` comes from assets.generated.json (see scripts/assets.mjs) and is
// passed in so this module stays dependency-free and testable in plain Node.
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function assetStatus(asset, files) {
  if (typeof asset !== "string" || asset === "") {
    return "missing";
  }
  if (!Array.isArray(files) || !files.includes(asset)) {
    return "missing";
  }
  const dot = asset.lastIndexOf(".");
  const ext = dot === -1 ? "" : asset.slice(dot).toLowerCase();
  if (VIDEO_EXTS.has(ext)) {
    return "video";
  }
  if (IMAGE_EXTS.has(ext)) {
    return "image";
  }
  return "missing";
}
