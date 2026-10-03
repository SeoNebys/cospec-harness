// Automatic detail fetching (SCN-001 auto-fill; SCN-006 graceful failure).
// Fetches the link and extracts a title and short description from the HTML.
// On any network/parse failure it returns { ok:false } so the caller can let
// the user save manually instead of blocking them.

const TIMEOUT_MS = 6000;

function decodeEntities(s) {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function parseMetadata(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = matchMetaContent(html, /property=["']og:title["']/i);
  const title = decodeEntities(ogTitle || (titleMatch ? titleMatch[1] : ""))
    .replace(/\s+/g, " ")
    .slice(0, 300);

  const ogDesc = matchMetaContent(html, /property=["']og:description["']/i);
  const metaDesc = matchMetaContent(html, /name=["']description["']/i);
  const description = decodeEntities(ogDesc || metaDesc || "")
    .replace(/\s+/g, " ")
    .slice(0, 500);

  return { title, description };
}

// Find a <meta> tag matching `attrRe` and return its content attribute.
function matchMetaContent(html, attrRe) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (attrRe.test(tag)) {
      const c = tag.match(/content=["']([\s\S]*?)["']/i);
      if (c) return c[1];
    }
  }
  return "";
}

// fetchImpl is injectable for testing.
export async function fetchMetadata(url, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "BookmarkManager/1.0 (+metadata)" },
    });
    if (!res.ok) return { ok: false };
    const ct = res.headers.get("content-type") || "";
    if (ct && !ct.includes("html") && !ct.includes("text")) return { ok: false };
    const html = await res.text();
    const { title, description } = parseMetadata(html);
    if (!title && !description) return { ok: false };
    return { ok: true, title, description };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
