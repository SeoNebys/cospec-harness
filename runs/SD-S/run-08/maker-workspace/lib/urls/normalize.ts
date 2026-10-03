const MAX_URL_LENGTH = 2048;

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export type NormalizedUrl = { url: string; key: string; hostname: string };

export function normalizeUrl(input: string): NormalizedUrl {
  let candidate = input.trim();
  if (!candidate) throw new UrlValidationError("Enter a web address.");
  if (candidate.length > MAX_URL_LENGTH) throw new UrlValidationError("Web addresses must be 2,048 characters or fewer.");
  if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new UrlValidationError("Enter a valid web address."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new UrlValidationError("Only HTTP and HTTPS addresses are supported.");
  if (parsed.username || parsed.password) throw new UrlValidationError("Web addresses containing credentials are not supported.");
  if (!parsed.hostname) throw new UrlValidationError("Enter a web address with a valid host.");
  if (parsed.port && !((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443"))) {
    throw new UrlValidationError("Web addresses using nonstandard ports are not supported.");
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  const normalized = parsed.toString();
  return { url: normalized, key: normalized, hostname: parsed.hostname };
}

export function fallbackTitle(value: string): string {
  try {
    const { url } = normalizeUrl(value);
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, "").split("/").filter(Boolean).pop();
    return (path || parsed.hostname.replace(/^www\./, "")).slice(0, 300);
  } catch {
    return "Untitled bookmark";
  }
}
