import "server-only";
import * as cheerio from "cheerio";
import { getConfig } from "@/lib/config";
import { safeFetch, SafeFetchError } from "@/lib/http/safe-fetch";
import { normalizeBookmarkUrl } from "./url-normalizer";

export type MetadataDraft = {
  requestedUrl: string;
  normalizedUrl: string;
  title: string;
  pageDescription: string | null;
  iconUrl: string | null;
  finalUrl: string | null;
  status: "complete" | "partial" | "failed";
  warnings: string[];
};

function clean(value: string | undefined, max: number): string | null {
  const normalized = value?.replaceAll(/\s+/g, " ").trim();
  return normalized ? [...normalized].slice(0, max).join("") : null;
}

export function parsePageMetadata(html: Buffer, baseUrl: string) {
  const $ = cheerio.loadBuffer(html);
  const title = clean($("meta[property='og:title']").attr("content") ?? $("title").first().text(), 500);
  const description = clean(
    $("meta[property='og:description']").attr("content") ?? $("meta[name='description']").attr("content"),
    2000,
  );
  const rawIcon = $("link[rel~='icon']").first().attr("href");
  let iconUrl: string | null = null;
  try {
    iconUrl = new URL(rawIcon || "/favicon.ico", baseUrl).toString();
  } catch {
    iconUrl = null;
  }
  return { title, description, iconUrl };
}

export async function retrieveMetadata(input: string): Promise<MetadataDraft> {
  const normalized = normalizeBookmarkUrl(input);
  try {
    const fetched = await safeFetch(normalized.networkUrl, {
      maxBytes: getConfig().METADATA_MAX_BYTES,
      timeoutMs: getConfig().METADATA_TIMEOUT_MS,
      allowedContentTypes: /^(text\/html|application\/xhtml\+xml)$/,
    });
    const parsed = parsePageMetadata(fetched.body, fetched.finalUrl);
    const warnings: string[] = [];
    if (!parsed.title) warnings.push("This page did not publish a title, so a helpful title was created from its address.");
    if (!parsed.description) warnings.push("This page did not publish a description. You can add one if you like.");
    return {
      requestedUrl: normalized.url,
      normalizedUrl: normalized.normalizedUrl,
      title: parsed.title ?? normalized.fallbackTitle,
      pageDescription: parsed.description,
      iconUrl: parsed.iconUrl,
      finalUrl: fetched.finalUrl,
      status: warnings.length ? "partial" : "complete",
      warnings,
    };
  } catch (error) {
    const detail = error instanceof SafeFetchError ? error.message : "The page did not provide its details.";
    return {
      requestedUrl: normalized.url,
      normalizedUrl: normalized.normalizedUrl,
      title: normalized.fallbackTitle,
      pageDescription: null,
      iconUrl: null,
      finalUrl: null,
      status: "failed",
      warnings: [`${detail} You can still save this link.`],
    };
  }
}
