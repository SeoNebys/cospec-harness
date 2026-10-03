import * as cheerio from "cheerio";
import { cleanTitle } from "../../shared/validation/bookmark.js";

export type ParsedMetadata = { title: string | null; iconUrl: URL | null };

function capped(value: string | undefined): string | null {
  const cleaned = cleanTitle(value ?? "");
  return cleaned ? [...cleaned].slice(0, 300).join("") : null;
}

export function parseMetadata(html: Buffer, finalUrl: string): ParsedMetadata {
  const $ = cheerio.loadBuffer(html, { xml: false });
  const title = capped($("title").first().text())
    ?? capped($('meta[property="og:title"]').attr("content"))
    ?? capped($('meta[name="twitter:title"]').attr("content"));
  const baseHref = $("base[href]").first().attr("href");
  let base = new URL(finalUrl);
  if (baseHref) {
    try { base = new URL(baseHref, base); } catch { /* ignore invalid base */ }
  }
  const iconHref = $('link[rel~="icon"][href]').first().attr("href") ?? "/favicon.ico";
  let iconUrl: URL | null = null;
  try { iconUrl = new URL(iconHref, base); } catch { /* generic icon */ }
  return { title, iconUrl };
}
