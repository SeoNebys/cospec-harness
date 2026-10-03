// Best-effort metadata capture (FR-002/005). Never throws — returns whatever
// could be collected; missing fields are omitted so the caller falls back to the
// address as the display name.

const FETCH_TIMEOUT_MS = 8000;

function absolutize(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function firstMatch(html, regexes) {
  for (const re of regexes) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function fetchMetadata(url) {
  const result = {};
  let html = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+metadata)' },
    });
    clearTimeout(timer);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      // Non-HTML (e.g., PDF): no metadata to extract.
      return result;
    }
    html = await res.text();
  } catch {
    // Unreachable / timeout / blocked: return whatever we have (nothing).
    return result;
  }

  const title = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]);
  if (title) result.title = title;

  const description = firstMatch(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
  ]);
  if (description) result.description = description;

  const preview = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const previewAbs = absolutize(url, preview);
  if (previewAbs) result.preview_image_url = previewAbs;

  const icon = firstMatch(html, [
    /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i,
  ]);
  let iconAbs = absolutize(url, icon);
  // Ignore empty/placeholder data-URI icons some pages use to suppress requests.
  if (iconAbs && iconAbs.startsWith('data:') && iconAbs.length < 32) {
    iconAbs = null;
  }
  if (!iconAbs) {
    // Fall back to the site's default /favicon.ico.
    iconAbs = absolutize(url, '/favicon.ico');
  }
  if (iconAbs) result.icon_url = iconAbs;

  return result;
}
