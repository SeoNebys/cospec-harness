// Auto-fill page details from the live page (SCN-001, NFR-004), with a graceful
// fallback (SCN-008): a valid link whose page can't be read is still saveable,
// with a best-effort title derived from the address and autofilled=false.

import { ensureScheme } from "./normalize.js";
import { safeFetch } from "./net.js";

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}
function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return "";
}
function absolute(base, ref) {
  if (!ref) return "";
  try { return new URL(ref, base).href; } catch { return ""; }
}

export function fallbackDetails(rawUrl) {
  const url = ensureScheme(rawUrl);
  let host = "", path = "";
  try { const u = new URL(url); host = u.hostname.replace(/^www\./, ""); path = u.pathname; } catch { host = String(rawUrl); }
  let title = "";
  const seg = path.split("/").filter(Boolean).pop() || "";
  if (seg) title = decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  if (title) title = title.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: title || host,
    description: "",
    site: host,
    iconUrl: host ? "https://" + host + "/favicon.ico" : "",
    imageUrl: "",
    autofilled: false,
  };
}

export async function fetchMetadata(rawUrl) {
  const url = ensureScheme(rawUrl);
  try {
    const res = await safeFetch(url);
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return fallbackDetails(url);
    if (ctype.includes("application/pdf")) {
      const fb = fallbackDetails(url);
      return { ...fb, autofilled: true };
    }
    const html = (await res.text()).slice(0, 500000);
    const u = new URL(res.url || url);
    const site = u.hostname.replace(/^www\./, "");
    const title =
      metaContent(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i]) || fallbackDetails(url).title;
    const description = metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    ]);
    const ogImage = metaContent(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);
    let icon = metaContent(html, [/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i]);
    return {
      title: title || site,
      description,
      site,
      iconUrl: icon ? absolute(u.href, icon) : "https://" + site + "/favicon.ico",
      imageUrl: ogImage ? absolute(u.href, ogImage) : "",
      autofilled: true,
    };
  } catch {
    return fallbackDetails(url);
  }
}
