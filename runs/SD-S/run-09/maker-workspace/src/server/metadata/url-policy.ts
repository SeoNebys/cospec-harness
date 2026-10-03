import { cleanTitle } from "../../shared/validation/bookmark.js";

export type ParsedBookmarkUrl = {
  displayUrl: string;
  normalizedUrl: string;
  networkUrl: URL;
  fallbackTitle: string;
  metadataEligible: boolean;
};

export function parseBookmarkUrl(input: string): ParsedBookmarkUrl {
  const displayUrl = input.trim();
  const url = new URL(displayUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("UNSUPPORTED_SCHEME");
  if (url.username || url.password) throw new Error("CREDENTIALS_NOT_ALLOWED");
  const networkUrl = new URL(url);
  networkUrl.hash = "";
  const normalized = new URL(networkUrl);
  normalized.hostname = normalized.hostname.toLowerCase();
  if ((normalized.protocol === "http:" && normalized.port === "80") || (normalized.protocol === "https:" && normalized.port === "443")) {
    normalized.port = "";
  }
  const hostname = url.hostname.replace(/^www\./i, "");
  const readablePath = decodeURIComponent(url.pathname).split("/").filter(Boolean).at(-1)?.replace(/[-_]+/g, " ");
  const fallbackTitle = cleanTitle(readablePath ? `${hostname} — ${readablePath}` : hostname).slice(0, 300) || "Untitled bookmark";
  const metadataEligible = url.port === "" || (url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443");
  return { displayUrl, normalizedUrl: normalized.toString(), networkUrl, fallbackTitle, metadataEligible };
}
