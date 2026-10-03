const MAX_URL_LENGTH = 2048;

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export function normalizeBookmarkUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    throw new UrlValidationError("Enter a web address no longer than 2,048 characters.");
  }

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  if (!hasScheme && !trimmed.includes(".")) {
    throw new UrlValidationError("Enter a complete web address, such as example.com/article.");
  }

  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UrlValidationError("Enter a valid web address.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError("Only HTTP and HTTPS web addresses can be saved.");
  }
  if (url.username || url.password) {
    throw new UrlValidationError("Web addresses containing credentials cannot be saved.");
  }
  if (!url.hostname || (!url.hostname.includes(".") && !/^\[[a-f\d:]+\]$/i.test(url.host))) {
    throw new UrlValidationError("Enter a public web hostname.");
  }

  url.hash = "";
  const normalized = url.toString();
  if (normalized.length > MAX_URL_LENGTH) {
    throw new UrlValidationError("Enter a web address no longer than 2,048 characters.");
  }
  return normalized;
}

export function fallbackTitle(input: string) {
  const url = new URL(input);
  const hostname = url.hostname.replace(/^www\./i, "");
  const rawSegment = url.pathname.split("/").filter(Boolean).at(-1);
  if (!rawSegment) return hostname;
  let segment = rawSegment;
  try { segment = decodeURIComponent(segment); } catch { /* retain safe encoded text */ }
  segment = segment.replace(/[-_]+/g, " ").replace(/\.[a-z\d]{1,8}$/i, "").replace(/\s+/g, " ").trim();
  return segment ? `${hostname} — ${segment}`.slice(0, 300) : hostname;
}
