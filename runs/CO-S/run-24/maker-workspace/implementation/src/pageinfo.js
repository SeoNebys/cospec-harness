// Reads a page's title and description from its address (SCN-001). Server-side,
// so there is no browser CORS restriction. On any failure the caller falls back
// to SCN-006 behaviour (save anyway, show the address, let the user fill in).

function decode(s) {
  if (s == null) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const v = decode(m[1]);
      if (v) return v;
    }
  }
  return "";
}

export function parsePageInfo(html) {
  if (!html) return { title: "", description: "" };
  const head = html.slice(0, 200000); // titles/meta live near the top
  const title =
    metaContent(head, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]) ||
    (function () {
      const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return m ? decode(m[1]) : "";
    })();
  const description = metaContent(head, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
  ]);
  return { title, description };
}

// Fetches and parses page info. Returns { title, description, ok }.
// Never throws; a failure yields ok:false with empty fields (SCN-006).
export async function fetchPageInfo(url, { timeoutMs = 4000, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkApp/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res || !res.ok) return { title: "", description: "", ok: false };
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (ctype && !ctype.includes("html") && !ctype.includes("xml")) {
      return { title: "", description: "", ok: false };
    }
    const html = await res.text();
    const info = parsePageInfo(html);
    return { title: info.title, description: info.description, ok: !!info.title };
  } catch (e) {
    return { title: "", description: "", ok: false };
  } finally {
    clearTimeout(timer);
  }
}
