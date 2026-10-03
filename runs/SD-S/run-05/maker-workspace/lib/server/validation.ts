const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string, max: number): string {
  return value.replace(CONTROL_CHARACTERS, "").replace(/\s+/gu, " ").trim().slice(0, max);
}

export function parseBookmarkUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new ValidationError("Enter a valid web address.", "url"); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new ValidationError("Only http and https addresses are supported.", "url");
  if (url.username || url.password) throw new ValidationError("Addresses containing credentials are not supported.", "url");
  url.hash = "";
  return { url: url.toString(), normalizedUrl: url.toString() };
}

export function normalizeTag(value: string) {
  const name = cleanText(value.normalize("NFC"), 40);
  return { name, normalizedName: name.toLocaleLowerCase("en-US") };
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) { super(message); }
}
