// Tag normalisation (SCN-008): lowercased, leading '#' dropped, internal
// whitespace collapsed to single hyphens. The same normalised tag is never
// stored twice on one bookmark (callers de-duplicate).

export function normalizeTag(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function addTag(tags, raw) {
  const t = normalizeTag(raw);
  if (!t) return tags.slice();
  return tags.indexOf(t) === -1 ? tags.concat([t]) : tags.slice();
}

export function removeTag(tags, raw) {
  const t = normalizeTag(raw);
  return tags.filter((x) => x !== t);
}
