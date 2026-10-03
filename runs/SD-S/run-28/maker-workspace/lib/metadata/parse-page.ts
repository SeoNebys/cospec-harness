import * as cheerio from "cheerio";

function clean(value: string | undefined, max: number): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function firstPresent(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()));
}

export interface ParsedPage { title: string | null; description: string | null; iconHref: string | null }

export function parsePage(buffer: Buffer): ParsedPage {
  const $ = cheerio.loadBuffer(buffer);
  const content = (selector: string) => $(selector).first().attr("content");
  const title = clean(firstPresent(content('meta[property="og:title"]'), $("title").first().text(), content('meta[name="twitter:title"]')), 300);
  const description = clean(firstPresent(content('meta[property="og:description"]'), content('meta[name="description"]'), content('meta[name="twitter:description"]')), 1000);
  const iconHref = $("link[rel~='icon']").first().attr("href") ?? null;
  return { title, description, iconHref };
}
