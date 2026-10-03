import { loadBuffer } from "cheerio";

function cleanText(value: string | undefined, max: number) {
  if (!value) return null;
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export function parsePageMetadata(buffer: Buffer) {
  const $ = loadBuffer(buffer, { xmlMode: false });
  const meta = new Map<string, string>();
  $("meta").each((_index, element) => {
    const key = ($(element).attr("name") ?? $(element).attr("property") ?? "").toLowerCase();
    const content = $(element).attr("content");
    if (key && content && !meta.has(key)) meta.set(key, content);
  });

  const title = cleanText(
    $("title").first().text() || meta.get("og:title") || meta.get("twitter:title"),
    300,
  );
  const description = cleanText(
    meta.get("description") || meta.get("og:description") || meta.get("twitter:description"),
    1000,
  );
  return { title, description };
}
