// Reads a page's title/summary so a pasted link "fills itself in" (SCN-001).
// Browser-only. Because a browser can't fetch arbitrary sites directly (cross-origin),
// this uses a read-through proxy; on ANY failure it reports ok:false so the caller
// keeps the link anyway with a fallback name (SCN-008 — never lose a link).
//
// Cycle-2 note: this is the seam where first-party page fetching + snapshots
// (incl. keeping PDFs as real files) will replace the third-party proxy.

const PROXY = (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
const TIMEOUT_MS = 9000;

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PROXY(url), { signal: ctrl.signal });
    if (!res.ok) throw new Error("bad status " + res.status);
    const contentType = res.headers.get("content-type") || "";
    if (/application\/pdf/i.test(contentType)) {
      // A PDF has no HTML title; keep the link, let the client name it.
      // (Cycle 2 will keep the file itself.)
      return { ok: false, isPdf: true };
    }
    return { ok: true, html: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

function extract(html, url) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (sel) => {
    const el = doc.querySelector(sel);
    return el ? (el.getAttribute("content") || "").trim() : "";
  };
  const title =
    meta('meta[property="og:title"]') ||
    (doc.querySelector("title")?.textContent || "").trim();
  const summary =
    meta('meta[name="description"]') || meta('meta[property="og:description"]');
  const siteName = meta('meta[property="og:site_name"]');
  return {
    ok: !!title,
    title: title || "",
    summary: summary || "",
    siteName: siteName || "",
  };
}

// Try, then one quiet retry, then give up (caller falls back — never blocks the save).
export async function resolveMetadata(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetchOnce(url);
      if (!r.ok) return { ok: false };
      const info = extract(r.html, url);
      if (info.ok) return info;
    } catch {
      /* try again once, then fall through */
    }
  }
  return { ok: false };
}
