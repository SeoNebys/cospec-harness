import * as cheerio from "cheerio";
import type { MetadataPreview } from "@/lib/bookmarks/types";

function absolute(value: string | undefined, base: string) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
export function extractMetadata(
  html: string,
  requestedUrl: string,
  finalUrl: string
): MetadataPreview {
  const $ = cheerio.load(html);
  const attr = (selector: string, key = "content") =>
    $(selector).first().attr(key)?.trim() || null;
  const title =
    attr('meta[property="og:title"]') ||
    $("title").first().text().trim() ||
    null;
  const description =
    attr('meta[property="og:description"]') || attr('meta[name="description"]');
  const siteIconUrl = absolute(
    attr('link[rel~="icon"]', "href") || "/favicon.ico",
    finalUrl
  );
  const previewImageUrl = absolute(
    attr('meta[property="og:image"]') || undefined,
    finalUrl
  );
  const warnings: string[] = [];
  if (!title) warnings.push("missing_title");
  if (!description) warnings.push("missing_description");
  if (!siteIconUrl) warnings.push("missing_icon");
  if (!previewImageUrl) warnings.push("missing_image");
  return {
    requestedUrl,
    finalUrl,
    title,
    description,
    siteIconUrl,
    previewImageUrl,
    warnings
  };
}
