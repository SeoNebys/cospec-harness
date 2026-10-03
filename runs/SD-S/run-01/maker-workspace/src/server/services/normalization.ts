export interface NormalizedTag {
  name: string;
  normalizedName: string;
}

export function normalizeUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('Only HTTP and HTTPS addresses are supported.');
  }
  return parsed.toString();
}

export function normalizeTags(values: string[]): NormalizedTag[] {
  const seen = new Set<string>();
  const result: NormalizedTag[] = [];
  for (const value of values) {
    const name = value.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const normalizedName = name.toLocaleLowerCase('en-US');
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    result.push({ name, normalizedName });
  }
  if (result.length > 20) throw new RangeError('Use no more than 20 tags.');
  return result;
}

export function normalizeTagFilter(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
