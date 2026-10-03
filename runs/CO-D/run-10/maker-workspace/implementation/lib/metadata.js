import dns from "node:dns/promises";
import net from "node:net";
import { cleanUrl, siteName } from "./url.js";

function decodeEntities(value = "") {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ").trim();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

export function parseMetadata(html, pageUrl) {
  const metas = [...String(html).matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const metaValue = (...names) => {
    for (const tag of metas) {
      const key = (attribute(tag, "property") || attribute(tag, "name")).toLowerCase();
      if (names.includes(key)) return attribute(tag, "content");
    }
    return "";
  };
  const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const iconTag = [...String(html).matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => /(?:^|\s)icon(?:\s|$)/i.test(attribute(tag, "rel")));
  const resolved = (value) => {
    try { return value ? new URL(value, pageUrl).toString() : ""; } catch { return ""; }
  };
  const page = new URL(pageUrl);
  return {
    title: metaValue("og:title", "twitter:title") || decodeEntities(titleMatch?.[1] || ""),
    description: metaValue("og:description", "twitter:description", "description"),
    previewImage: resolved(metaValue("og:image", "twitter:image")),
    favicon: resolved(iconTag ? attribute(iconTag, "href") : "") || `${page.origin}/favicon.ico`,
    siteName: metaValue("og:site_name") || page.hostname.replace(/^www\./, "")
  };
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
  }
  return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:");
}

async function assertPublicHost(url) {
  const host = new URL(url).hostname;
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private network pages are not fetched.");
}

export async function gatherMetadata(value, fetchImpl = fetch) {
  const url = cleanUrl(value);
  const fallback = { available: false, url, siteName: siteName(url), title: "", description: "", favicon: "", previewImage: "" };
  try {
    await assertPublicHost(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Keepsake Bookmark Reader/1.0", accept: "text/html,application/xhtml+xml" }
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`Page returned ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("html")) throw new Error("Page is not HTML");
    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (html.length < 1_500_000) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        html += decoder.decode(chunk, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = (await response.text()).slice(0, 1_500_000);
    }
    const finalUrl = response.url || url;
    return { available: true, url: finalUrl, ...parseMetadata(html, finalUrl) };
  } catch {
    return fallback;
  }
}
