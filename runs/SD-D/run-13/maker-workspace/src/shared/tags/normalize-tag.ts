import { LIMITS } from '../config/limits.js';

export function normalizeTag(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und');
}

export function validateTags(values: unknown): string[] {
  if (!Array.isArray(values)) throw new Error('Tags must be a list.');
  const byKey = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== 'string') throw new Error('Each tag must be text.');
    const display = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!display || [...display].length > LIMITS.tagLength) throw new Error(`Tags must be 1–${LIMITS.tagLength} characters.`);
    const key=normalizeTag(display);if(!byKey.has(key))byKey.set(key,display);
  }
  if (byKey.size > LIMITS.tagsPerBookmark) throw new Error(`Use no more than ${LIMITS.tagsPerBookmark} tags.`);
  return [...byKey.values()];
}
