import { invalidUrl } from "../errors.js";

/**
 * Validate a user-supplied web address and return both the canonical URL to
 * store and a normalized form used for duplicate detection.
 *
 * Rules (spec FR-002, research R5):
 *  - Only http/https absolute URLs are accepted.
 *  - normalizedUrl lower-cases scheme + host, trims a trailing slash, and drops
 *    the fragment so that trivially different spellings of the same page collide.
 */
export function validateAndNormalizeUrl(raw: string): {
  url: string;
  normalizedUrl: string;
} {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    throw invalidUrl("A web address is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw invalidUrl(
      `"${trimmed}" is not a valid web address. Include http:// or https://.`,
    );
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw invalidUrl(
      `Only http and https addresses are supported (got "${parsed.protocol}").`,
    );
  }

  const host = parsed.host.toLowerCase();
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  const normalizedUrl = `${protocol}//${host}${path}${parsed.search}`;

  return { url: parsed.href, normalizedUrl };
}

/** Normalize a list of tags: trim, lower-case, drop empties, de-duplicate, keep order. */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}
