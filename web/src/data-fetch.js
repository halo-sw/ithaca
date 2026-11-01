// Box data fetch (38d): box files (/data/st-*/.., /data/hm-*/..) ship
// gzipped on the static site (<file>.json.gz, no Content-Encoding), so the
// app decompresses them itself. Non-box files stay plain everywhere.
export const DATA_GZ = Boolean(import.meta.env && import.meta.env.PROD);

export function isBoxDataUrl(url) {
  let s = String(url);
  try {
    s = decodeURI(s);
  } catch {
    // Keep the raw string when decoding fails.
  }
  const i = s.indexOf("/data/");
  if (i < 0) return false;
  const path = s.slice(i).split(/[?#]/, 1)[0];
  return /^\/data\/(st-|hm-)[^/]+\/[^/]+\.json$/.test(path);
}

async function gunzipToText(res) {
  const ab = await res.arrayBuffer();
  const ds = new DecompressionStream("gzip");
  const stream = new Response(ab).body.pipeThrough(ds);
  return new Response(stream).text();
}

export async function fetchDataJson(url, { fetchImpl = fetch, gz = DATA_GZ } = {}) {
  if (gz && isBoxDataUrl(url)) {
    const gzRes = await fetchImpl(`${url}.gz`);
    if (gzRes.ok) return JSON.parse(await gunzipToText(gzRes));
    if (gzRes.status !== 404) throw new Error(`${url}: ${gzRes.status}`);
  }
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function fetchDataText(url, { fetchImpl = fetch, gz = DATA_GZ } = {}) {
  if (gz && isBoxDataUrl(url)) {
    const gzRes = await fetchImpl(`${url}.gz`);
    if (gzRes.ok) return gunzipToText(gzRes);
    if (gzRes.status !== 404) throw new Error(`${url}: ${gzRes.status}`);
  }
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}
