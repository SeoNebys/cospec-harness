// URL normalisation and validation shared by the API and metadata fetcher.
// Approved behaviour (SCN-010, SCN-008): a missing scheme is assumed https, and
// text that is not a usable web address is rejected.

export class InvalidUrlError extends Error {
  constructor(message = "That doesn't look like a web address.") {
    super(message);
    this.code = "invalid_url";
  }
}

// Returns { url, host } with url normalised (https:// added when the scheme is
// omitted) and host being the hostname without a leading "www.".
// Throws InvalidUrlError when the input cannot be a real web address.
export function normalizeUrl(input) {
  const raw = String(input == null ? "" : input).trim();
  if (!raw) throw new InvalidUrlError();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    throw new InvalidUrlError();
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new InvalidUrlError();
  const host = u.hostname.replace(/^www\./, "");
  if (!host) throw new InvalidUrlError();
  // A real web address has a dotted host, or is localhost / an IP address.
  // This rejects bare words like "hello" or "not a url".
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (host !== "localhost" && !isIp && host.indexOf(".") < 0) throw new InvalidUrlError();
  return { url: u.href, host };
}

// Case-insensitive comparison key for duplicate detection.
export function urlKey(url) {
  return String(url).trim().toLowerCase();
}
