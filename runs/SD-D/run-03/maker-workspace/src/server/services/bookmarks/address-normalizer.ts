import { type NormalizedAddress, normalizeAddress } from "../../../shared/types/address.js";

const MAX_FALLBACK_TITLE_LENGTH = 120;
const TITLE_SEPARATOR = " \u2014 ";

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  if (maximum <= 1) return "\u2026".slice(0, maximum);
  return `${value.slice(0, maximum - 1).trimEnd()}\u2026`;
}

function displayHost(hostname: string): string {
  const withoutCommonPrefix = hostname.replace(/^www\./iu, "");
  return truncate(withoutCommonPrefix, MAX_FALLBACK_TITLE_LENGTH);
}

function readablePathLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (!lastSegment) return "";

  const decoded = decodePathSegment(lastSegment);
  const words = decoded.replace(/[-_]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (words === "") return "";

  return `${words.charAt(0).toLocaleUpperCase("en-US")}${words.slice(1)}`;
}

/** Generates a stable, non-empty title while remote metadata is unavailable. */
export function fallbackTitleFromAddress(address: string): string {
  const { url } = normalizeAddress(address);
  const host = displayHost(url.hostname);
  const pathLabel = readablePathLabel(url.pathname);
  if (pathLabel === "") return host;

  const availablePathLength = Math.max(
    1,
    MAX_FALLBACK_TITLE_LENGTH - host.length - TITLE_SEPARATOR.length,
  );
  return `${truncate(pathLabel, availablePathLength)}${TITLE_SEPARATOR}${host}`;
}

export type { NormalizedAddress };
export { normalizeAddress };
