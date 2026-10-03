export function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeTitle(value: string) {
  return collapseWhitespace(value);
}

export function normalizeTag(value: string) {
  const name = collapseWhitespace(value).normalize("NFC");
  return { name, normalizedName: name.toLocaleLowerCase("en-US") };
}

export function normalizeBookmarkUrl(value: string) {
  const input = value.trim();
  if (!input || input.length > 2048) throw new Error("Enter a web address up to 2,048 characters.");
  let parsed: URL;
  try { parsed = new URL(input); } catch { throw new Error("Enter a complete web address, such as https://example.com."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http and https web addresses can be saved.");
  if (!parsed.hostname) throw new Error("The web address must include a host name.");
  if (parsed.username || parsed.password) throw new Error("Web addresses containing usernames or passwords cannot be saved.");
  return { url: parsed.href, normalizedUrl: parsed.href };
}
