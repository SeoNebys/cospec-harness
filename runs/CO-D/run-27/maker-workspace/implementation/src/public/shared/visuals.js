// Small helpers to derive a site icon (letter + colour) and preview label from a
// URL, used when a page has no image or for imported links.
const PALETTE = ["#2f6feb", "#e0447a", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4f46e5"];

export function colorFor(host) {
  let s = 0; for (let i = 0; i < host.length; i++) s += host.charCodeAt(i);
  return PALETTE[s % PALETTE.length];
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; }
}

export function deriveVisual(url) {
  const host = hostOf(url);
  const site = host.split(".")[0];
  const label = site ? site.charAt(0).toUpperCase() + site.slice(1) : "Link";
  const color = colorFor(host);
  return { icon: { letter: (label.charAt(0) || "?").toUpperCase(), color }, preview: { label, color } };
}

// A CSS background-image (inline SVG) used as a lightweight preview thumbnail.
export function svgPreview(label, color) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>` +
    '<rect width="600" height="360" fill="url(#g)"/>' +
    `<text x="30" y="330" font-family="sans-serif" font-size="26" fill="rgba(255,255,255,.9)">${label}</text>` +
    '</svg>';
  return "url('data:image/svg+xml;utf8," + encodeURIComponent(svg) + "')";
}
