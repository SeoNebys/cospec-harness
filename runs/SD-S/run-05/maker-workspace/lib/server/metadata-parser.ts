import * as cheerio from "cheerio";
import { cleanText } from "./validation";

export function parseMetadata(html: string) {
  const $ = cheerio.load(html);
  const meta = (selector: string) => $(selector).first().attr("content") ?? "";
  const title = cleanText($("title").first().text() || meta('meta[property="og:title" i]'), 300);
  const description = cleanText(meta('meta[name="description" i]') || meta('meta[property="og:description" i]'), 300);
  return { title: title || undefined, description: description || undefined };
}
