// Pure helpers to fill {stat:key} placeholders from stats.json.
// A line using a stat that is null/missing is dropped (returns null).
// Never prints "null", "undefined" or an empty number.

export function fillLine(line, stats) {
  if (typeof line !== "string") {
    return null;
  }
  if (!line.includes("{stat:")) {
    return line;
  }
  const re = /\{stat:([A-Za-z0-9_]+)\}/g;
  let missing = false;
  const filled = line.replace(re, (_m, key) => {
    const v = stats ? stats[key] : undefined;
    if (v === null || v === undefined) {
      missing = true;
      return "";
    }
    return String(v);
  });
  if (missing) {
    return null;
  }
  return filled;
}

export function fillLines(lines, stats) {
  if (!Array.isArray(lines)) {
    return [];
  }
  const out = [];
  for (const line of lines) {
    const filled = fillLine(line, stats);
    if (filled !== null) {
      out.push(filled);
    }
  }
  return out;
}

// A `source` (or footer) field whose stat is null/missing is dropped too.
export function fillSource(source, stats) {
  if (typeof source !== "string") {
    return null;
  }
  if (source.trim() === "") {
    return null;
  }
  return fillLine(source, stats);
}
