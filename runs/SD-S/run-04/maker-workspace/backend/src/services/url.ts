import { badRequest } from "../api/errors.js";

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_eid$/i,
  /^mc_cid$/i,
  /^ref$/i,
  /^ref_src$/i,
];

/** True when the input parses as an http/https URL. */
export function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Produce a canonical form of a URL for duplicate detection (research §5):
 * lowercase scheme + host, drop default ports, strip trailing slash, remove
 * common tracking params, sort remaining params, drop the fragment.
 */
export function normalizeUrl(input: string): string {
  const u = new URL(input.trim());
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }

  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) {
      u.searchParams.delete(key);
    }
  }
  u.searchParams.sort();

  u.hash = "";

  let normalized = u.toString();
  // Strip a trailing slash on the path (but keep a bare host like https://x.com).
  normalized = normalized.replace(/\/+$/, "");
  return normalized;
}

/** Validate an incoming URL and return the trimmed original + normalized form. */
export function validateAndNormalize(input: string): { url: string; normalized: string } {
  const trimmed = (input ?? "").trim();
  if (!trimmed) throw badRequest("A web address is required.");
  if (!isValidUrl(trimmed)) {
    throw badRequest("That doesn't look like a valid web address (must start with http:// or https://).");
  }
  return { url: trimmed, normalized: normalizeUrl(trimmed) };
}
