import { load } from "cheerio";

const ACTIVE_ICON_TYPES = new Set([
  "image/svg+xml",
  "application/svg+xml",
  "application/xml",
  "text/xml",
  "text/html",
  "application/xhtml+xml",
]);

export type MetadataTitleSource = "html" | "open_graph" | "fallback";
export type MetadataDescriptionSource = "standard" | "open_graph" | "missing";

export interface MetadataIconCandidate {
  url: string;
  source: "declared" | "fallback";
  declaredType: string | null;
  rel: string;
  sizes: string | null;
}

export interface ExtractedPageMetadata {
  title: string;
  titleSource: MetadataTitleSource;
  description: string;
  descriptionSource: MetadataDescriptionSource;
  iconCandidates: MetadataIconCandidate[];
  baseUrl: URL;
}

interface ParsedAttributes {
  [name: string]: string;
}

/** Normalize untrusted metadata into short, single-line display text. */
export function cleanMetadataText(value: string | null | undefined, maxScalars: number): string {
  if (!value || maxScalars <= 0) return "";

  const withoutControls = Array.from(value.normalize("NFC"), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControl = codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
    if (!isControl) return character;
    return character === "\t" || character === "\n" || character === "\r" || character === "\f"
      ? " "
      : "";
  }).join("");
  const cleaned = withoutControls.replace(/\s+/gu, " ").trim();

  return Array.from(cleaned).slice(0, maxScalars).join("").trimEnd();
}

function safeUrl(value: string, base?: URL): URL | null {
  try {
    const parsed = base ? new URL(value, base) : new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function metadataFallbackTitle(address: URL | string): string {
  const url = typeof address === "string" ? new URL(address) : address;
  const hostname = url.hostname.replace(/^www\./iu, "") || url.hostname;
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map(decodePathSegment)
    .map((segment) => cleanMetadataText(segment, 80))
    .filter(Boolean)
    .slice(0, 3);

  return segments.length > 0 ? `${hostname} / ${segments.join(" / ")}` : hostname;
}

function parseAttributes(tag: string): ParsedAttributes {
  const attributes: ParsedAttributes = {};
  const expression = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  for (const match of tag.matchAll(expression)) {
    const name = match[1]?.toLocaleLowerCase("en-US");
    if (name) attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function rawTags(html: string, tagName: "base" | "link" | "meta"): ParsedAttributes[] {
  const expression = new RegExp(`<${tagName}\\b[^>]*>`, "giu");
  return Array.from(html.matchAll(expression), (match) => parseAttributes(match[0]));
}

function findRawMeta(html: string, key: "name" | "property", expected: string): string {
  for (const attributes of rawTags(html, "meta")) {
    if (attributes[key]?.toLocaleLowerCase("en-US") === expected) {
      const content = cleanMetadataText(attributes.content, 2_048);
      if (content) return content;
    }
  }
  return "";
}

function firstValidBase(html: string, documentUrl: URL, cheerioBases: string[]): URL {
  const candidates = [...cheerioBases, ...rawTags(html, "base").map((item) => item.href ?? "")];
  for (const candidate of candidates) {
    const resolved = safeUrl(candidate, documentUrl);
    if (resolved) return resolved;
  }
  return documentUrl;
}

function isIconRel(rel: string): boolean {
  const words = rel.toLocaleLowerCase("en-US").split(/\s+/u);
  return words.includes("icon") || words.includes("apple-touch-icon");
}

function isPotentiallyRasterIcon(href: string, type: string): boolean {
  const normalizedType = type.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US") ?? "";
  if (ACTIVE_ICON_TYPES.has(normalizedType)) return false;
  if (normalizedType && !normalizedType.startsWith("image/") && normalizedType !== "image/x-icon") {
    return false;
  }
  return !/\.(?:svg|svgz|xml|html?|xhtml)(?:$|[?#])/iu.test(href);
}

function deduplicateIcons(candidates: MetadataIconCandidate[]): MetadataIconCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

/** Parse static HTML only. Candidate bytes still require validation by processIcon. */
export function extractPageMetadata(
  html: string | Buffer,
  finalAddress: URL | string,
): ExtractedPageMetadata {
  const source = Buffer.isBuffer(html) ? html.toString("utf8") : html;
  const documentUrl =
    typeof finalAddress === "string" ? new URL(finalAddress) : new URL(finalAddress.href);
  if (documentUrl.protocol !== "http:" && documentUrl.protocol !== "https:") {
    throw new TypeError("Page metadata requires an HTTP(S) address");
  }

  const $ = load(source);
  const baseUrl = firstValidBase(
    source,
    documentUrl,
    $("base[href]")
      .toArray()
      .map((element) => $(element).attr("href") ?? ""),
  );

  const parsedTitle = cleanMetadataText($("title").first().text(), 512);
  // HTML parsers correctly treat an unclosed title as raw text. Recover the useful prefix.
  const nativeTitle = cleanMetadataText(parsedTitle.split(/<(?=meta|link|body)\b/iu, 1)[0], 512);
  const graphTitle = cleanMetadataText(
    $('meta[property="og:title" i]').first().attr("content") ??
      findRawMeta(source, "property", "og:title"),
    512,
  );
  const title = nativeTitle || graphTitle || metadataFallbackTitle(documentUrl);
  const titleSource: MetadataTitleSource = nativeTitle
    ? "html"
    : graphTitle
      ? "open_graph"
      : "fallback";

  const standardDescription = cleanMetadataText(
    $('meta[name="description" i]').first().attr("content") ??
      findRawMeta(source, "name", "description"),
    2_048,
  );
  const graphDescription = cleanMetadataText(
    $('meta[property="og:description" i]').first().attr("content") ??
      findRawMeta(source, "property", "og:description"),
    2_048,
  );
  const description = standardDescription || graphDescription;
  const descriptionSource: MetadataDescriptionSource = standardDescription
    ? "standard"
    : graphDescription
      ? "open_graph"
      : "missing";

  const cheerioLinks = $("link[href]")
    .toArray()
    .map((element) => ({
      href: $(element).attr("href") ?? "",
      rel: $(element).attr("rel") ?? "",
      type: $(element).attr("type") ?? "",
      sizes: $(element).attr("sizes") ?? "",
    }));
  const recoveredLinks = rawTags(source, "link").map((item) => ({
    href: item.href ?? "",
    rel: item.rel ?? "",
    type: item.type ?? "",
    sizes: item.sizes ?? "",
  }));

  const declaredIcons: MetadataIconCandidate[] = [...cheerioLinks, ...recoveredLinks]
    .filter((item) => isIconRel(item.rel) && isPotentiallyRasterIcon(item.href, item.type))
    .flatMap((item) => {
      const resolved = safeUrl(item.href, baseUrl);
      return resolved
        ? [
            {
              url: resolved.href,
              source: "declared" as const,
              declaredType: item.type.trim() || null,
              rel: item.rel,
              sizes: item.sizes.trim() || null,
            },
          ]
        : [];
    });

  const faviconUrl = new URL("/favicon.ico", documentUrl.origin).href;
  const iconCandidates = deduplicateIcons([
    ...declaredIcons,
    {
      url: faviconUrl,
      source: "fallback",
      declaredType: null,
      rel: "icon",
      sizes: null,
    },
  ]);

  return { title, titleSource, description, descriptionSource, iconCandidates, baseUrl };
}

export const extractMetadata = extractPageMetadata;
