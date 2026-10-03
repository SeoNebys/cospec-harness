// Shared URL validation (FR-001). Accepts well-formed http/https URLs only.
export function normalizeAndValidateUrl(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, error: 'A web address is required.' };
  }
  const value = String(raw).trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'That is not a valid web address.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'The address must start with http:// or https://.' };
  }
  return { ok: true, url: parsed.href };
}
