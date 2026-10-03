export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export type NormalizedBookmarkUrl = {
  url: string;
  normalizedUrl: string;
  networkUrl: string;
  fallbackTitle: string;
  version: 1;
};

function titleCaseHost(hostname: string): string {
  const host = hostname.replace(/^www\./i, "");
  return host.charAt(0).toUpperCase() + host.slice(1);
}

export function normalizeBookmarkUrl(input: string): NormalizedBookmarkUrl {
  let candidate = input.trim();
  if (!candidate) throw new UrlValidationError("Enter a web address.");
  if (candidate.length > 4096) throw new UrlValidationError("Web addresses must be 4,096 characters or fewer.");
  if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new UrlValidationError("Enter a complete public web address, such as example.com/article.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError("Only HTTP and HTTPS web addresses can be saved.");
  }
  if (!parsed.hostname) throw new UrlValidationError("The web address needs a host name.");
  if (parsed.username || parsed.password) throw new UrlValidationError("Web addresses containing credentials cannot be saved.");

  parsed.hostname = parsed.hostname.toLowerCase();
  const url = parsed.toString();
  if (url.length > 4096) throw new UrlValidationError("Web addresses must be 4,096 characters or fewer.");
  const network = new URL(url);
  network.hash = "";
  const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1);
  const readableSegment = lastSegment ? decodeURIComponent(lastSegment).replaceAll(/[-_]+/g, " ") : "";
  const fallbackTitle = readableSegment
    ? `${titleCaseHost(parsed.hostname)} — ${readableSegment}`
    : titleCaseHost(parsed.hostname);

  return { url, normalizedUrl: url, networkUrl: network.toString(), fallbackTitle, version: 1 };
}
