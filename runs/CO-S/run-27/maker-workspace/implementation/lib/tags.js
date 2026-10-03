export function normalizeTag(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function normalizeTags(values = []) {
  return [...new Set(values.map(normalizeTag).filter(Boolean))];
}
