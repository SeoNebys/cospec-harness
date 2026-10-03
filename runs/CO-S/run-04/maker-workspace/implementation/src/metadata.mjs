// Server-side extraction of page details (SCN-001): title, description,
// preview image, favicon. Pure parsing is separated from network I/O so it can
// be unit-tested without fetching.

export function resolveUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, baseUrl).href;
  } catch {
    return "";
  }
}

function firstMatch(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return "";
}

// Extract a content= attribute for a meta tag identified by property/name,
// tolerating attribute order (content before or after the identifying attr).
function metaContent(html, key, value) {
  const attr = `${key}=["']${value}["']`;
  const patterns = [
    new RegExp(`<meta[^>]*${attr}[^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}`, "i"),
  ];
  return firstMatch(html, patterns);
}

export function parseMetadata(html, baseUrl) {
  const text = String(html == null ? "" : html);

  const title =
    metaContent(text, "property", "og:title") ||
    metaContent(text, "name", "twitter:title") ||
    firstMatch(text, [/<title[^>]*>([\s\S]*?)<\/title>/i]);

  const description =
    metaContent(text, "property", "og:description") ||
    metaContent(text, "name", "description") ||
    metaContent(text, "name", "twitter:description");

  const rawImage =
    metaContent(text, "property", "og:image:secure_url") ||
    metaContent(text, "property", "og:image") ||
    metaContent(text, "name", "twitter:image");
  const image = rawImage ? resolveUrl(rawImage, baseUrl) : "";

  const favicon = extractFavicon(text, baseUrl);

  let host = "";
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  return {
    title: (title || "").replace(/\s+/g, " ").trim(),
    description: (description || "").replace(/\s+/g, " ").trim(),
    image,
    favicon,
    host,
  };
}

export function extractFavicon(html, baseUrl) {
  const linkTags = html.match(/<link[^>]+>/gi) || [];
  for (const tag of linkTags) {
    if (/rel=["'][^"']*icon[^"']*["']/i.test(tag)) {
      const href = tag.match(/href=["']([^"']+)["']/i);
      if (href && href[1]) {
        const resolved = resolveUrl(href[1], baseUrl);
        if (resolved) return resolved;
      }
    }
  }
  // Fallback to the site's conventional /favicon.ico.
  try {
    return new URL("/favicon.ico", baseUrl).href;
  } catch {
    return "";
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}
