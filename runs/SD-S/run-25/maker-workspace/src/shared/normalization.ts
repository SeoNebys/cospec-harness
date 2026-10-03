export interface NormalizedBookmarkUrl {
  /** Canonical WHATWG serialization retained for storage and navigation. */
  url: string;
  /** Canonical URL without a fragment, used for duplicate detection. */
  urlKey: string;
}

export interface NormalizedTag {
  /** Trimmed first-entered spelling retained for display. */
  displayName: string;
  /** Trimmed, NFKC-normalized, lowercase identity key. */
  normalizedName: string;
}

const parseBookmarkUrl = (value: string): URL => {
  const parsed = new URL(value.trim());

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("Bookmark URL must use HTTP or HTTPS.");
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new TypeError("Bookmark URL must not contain credentials.");
  }

  return parsed;
};

export const canonicalizeBookmarkUrl = (value: string): string =>
  parseBookmarkUrl(value).toString();

export const createUrlKey = (value: string): string => {
  const parsed = parseBookmarkUrl(value);
  parsed.hash = "";
  return parsed.toString();
};

export const normalizeBookmarkUrl = (value: string): NormalizedBookmarkUrl => {
  const parsed = parseBookmarkUrl(value);
  const url = parsed.toString();
  parsed.hash = "";

  return { url, urlKey: parsed.toString() };
};

export const normalizeTagName = (value: string): string =>
  value.trim().normalize("NFKC").toLowerCase();

export const normalizeTag = (value: string): NormalizedTag => ({
  displayName: value.trim(),
  normalizedName: normalizeTagName(value),
});

/**
 * Normalize and de-duplicate tags while retaining the first entered display
 * spelling and original order.
 */
export const normalizeTags = (values: readonly string[]): NormalizedTag[] => {
  const tags = new Map<string, NormalizedTag>();

  for (const value of values) {
    const tag = normalizeTag(value);
    if (!tags.has(tag.normalizedName)) tags.set(tag.normalizedName, tag);
  }

  return [...tags.values()];
};
