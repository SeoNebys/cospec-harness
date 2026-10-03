export function normalizeWhitespace(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeTag(value: string): { name: string; nameKey: string } {
  const name = normalizeWhitespace(value);
  return { name, nameKey: name.toLocaleLowerCase("und") };
}

export function normalizeTags(values: string[]): Array<{ name: string; nameKey: string }> {
  const result = new Map<string, { name: string; nameKey: string }>();
  for (const value of values) {
    const tag = normalizeTag(value);
    if (tag.name && !result.has(tag.nameKey)) result.set(tag.nameKey, tag);
  }
  return [...result.values()];
}
