export function normalizeUrl(input: string): string {
  if (input.length > 2048) throw new Error("URL must be 2,048 characters or fewer.");
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Enter a complete web address."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only http and https links are supported.");
  if (url.username || url.password) throw new Error("Links containing credentials are not supported.");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
  if (url.pathname === "") url.pathname = "/";
  return url.toString();
}
