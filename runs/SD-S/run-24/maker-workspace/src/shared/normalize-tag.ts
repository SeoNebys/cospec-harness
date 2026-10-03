export interface NormalizedTag {
  name: string;
  normalizedName: string;
}

const normalizeDisplay = (input: string) => input.normalize('NFKC').trim().replace(/\s+/gu, ' ');

export function normalizeTag(input: string): NormalizedTag {
  const name = normalizeDisplay(input);
  if (Array.from(name).length < 1 || Array.from(name).length > 40) {
    throw new Error('Tag must be between 1 and 40 characters.');
  }

  return { name, normalizedName: name.toLowerCase() };
}

export function normalizeTags(inputs: string[]): NormalizedTag[] {
  if (inputs.length > 20) {
    throw new Error('Add no more than 20 tags.');
  }

  const seen = new Set<string>();
  const normalized: NormalizedTag[] = [];
  for (const input of inputs) {
    const tag = normalizeTag(input);
    if (!seen.has(tag.normalizedName)) {
      seen.add(tag.normalizedName);
      normalized.push(tag);
    }
  }
  return normalized;
}
