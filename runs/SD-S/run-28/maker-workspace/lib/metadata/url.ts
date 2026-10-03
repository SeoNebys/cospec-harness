import { createHash } from "node:crypto";

export class UrlValidationError extends Error {}

export interface NormalizedUrl { storedUrl: string; fetchUrl: string; hash: Buffer; fallbackTitle: string }

export function normalizeBookmarkUrl(input: string): NormalizedUrl {
  let value = input.trim();
  if (!value) throw new UrlValidationError("Enter a web address.");
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new UrlValidationError("Enter a valid web address."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new UrlValidationError("Only HTTP and HTTPS addresses can be saved.");
  if (parsed.username || parsed.password) throw new UrlValidationError("Addresses containing credentials cannot be saved.");
  if (!parsed.hostname) throw new UrlValidationError("Enter a web address with a public hostname.");
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  const storedUrl = parsed.toString();
  if (storedUrl.length > 2048) throw new UrlValidationError("The web address must be 2,048 characters or fewer.");
  const fetchTarget = new URL(storedUrl); fetchTarget.hash = "";
  return {
    storedUrl,
    fetchUrl: fetchTarget.toString(),
    hash: createHash("sha256").update(storedUrl).digest(),
    fallbackTitle: fallbackTitle(parsed),
  };
}

function fallbackTitle(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const segment = url.pathname.split("/").filter(Boolean).at(-1);
  if (!segment) return host;
  const words = decodeURIComponent(segment).replace(/[-_]+/g, " ").replace(/\.[a-z\d]{1,6}$/i, "").trim();
  return words ? `${words.slice(0, 180)} — ${host}` : host;
}
