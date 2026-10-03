export function normalizeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || value.length > 40) continue;
    const key = value.toLocaleLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(value); }
  }
  if (result.length > 20) throw new Error('A bookmark can have at most 20 tags.');
  return result;
}
