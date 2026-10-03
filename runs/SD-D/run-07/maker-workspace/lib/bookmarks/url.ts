export class UrlError extends Error { constructor(public code: string, message: string) { super(message); } }

export function normalizeUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new UrlError("INVALID_URL", "Enter a complete web address."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UrlError("UNSUPPORTED_SCHEME", "Only HTTP and HTTPS links are supported.");
  if (url.username || url.password) throw new UrlError("INVALID_URL", "Links containing credentials are not supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UrlError("UNSUPPORTED_PORT", "Only standard web ports are supported.");
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}
