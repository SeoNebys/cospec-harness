import * as cheerio from "cheerio";

export interface IconCandidate {
  url: string;
  type: string | null;
  sizes: string[];
}

export interface DocumentMetadata {
  title: string | null;
  iconCandidates: IconCandidate[];
}

const MAX_TITLE_LENGTH = 300;

function normalizedText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function iconScore(candidate: IconCandidate): number {
  const type = candidate.type?.toLowerCase() ?? "";
  if (type.includes("svg")) return -1;
  let score = type === "image/png" ? 30 : type.startsWith("image/") ? 20 : 10;
  for (const size of candidate.sizes) {
    const match = /^(\d+)x(\d+)$/i.exec(size);
    if (match) {
      const dimension = Math.min(Number(match[1]), Number(match[2]));
      score += Math.min(dimension, 512) / 512;
    }
  }
  return score;
}

export function parseDocumentMetadata(html: string, documentUrl: string): DocumentMetadata {
  // Cheerio parses inert text only: scripts are never run and subresources are never loaded.
  const $ = cheerio.load(html, { xmlMode: false });
  const rawTitle = $("head title").first().text();
  const title = normalizedText(rawTitle).slice(0, MAX_TITLE_LENGTH) || null;
  const candidates: IconCandidate[] = [];

  $("head link[href]").each((_index, element) => {
    const relTokens = ($(element).attr("rel") ?? "")
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean);
    if (!relTokens.includes("icon")) return;
    try {
      const url = new URL($(element).attr("href")!, documentUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const type = $(element).attr("type")?.trim().toLowerCase() || null;
      const sizes = ($(element).attr("sizes") ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
      const candidate = { url: url.href, type, sizes };
      if (iconScore(candidate) >= 0) candidates.push(candidate);
    } catch {
      // A malformed declaration is ignored rather than failing the page preview.
    }
  });

  candidates.sort((a, b) => iconScore(b) - iconScore(a));
  const favicon = new URL("/favicon.ico", documentUrl).href;
  if (!candidates.some((candidate) => candidate.url === favicon)) {
    candidates.push({ url: favicon, type: "image/x-icon", sizes: [] });
  }
  return { title, iconCandidates: candidates };
}

export function fallbackTitle(url: string): string {
  const parsed = new URL(url);
  const path = decodeURIComponent(parsed.pathname).replace(/\/+$/u, "");
  return normalizedText(`${parsed.hostname}${path === "/" ? "" : path}`).slice(0, MAX_TITLE_LENGTH) || parsed.hostname;
}

