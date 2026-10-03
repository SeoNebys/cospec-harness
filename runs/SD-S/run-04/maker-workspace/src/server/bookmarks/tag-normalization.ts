export const normalizeTag = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function distinctTags(values: string[]): string[] {
  const tags = new Map<string, string>();
  for (const raw of values) {
    const display = raw.trim().replace(/\s+/g, ' ');
    if (display) tags.set(normalizeTag(display), tags.get(normalizeTag(display)) ?? display);
  }
  return [...tags.values()];
}
