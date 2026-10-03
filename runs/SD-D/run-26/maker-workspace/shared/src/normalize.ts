const markdownPunctuation = /(?:^|\s)(?:#{1,6}|>|[-+*]|\d+\.)\s|[*_~`]|\[([^\]]+)\]\([^)]*\)/gm;

export function scalarLength(value: string): number {
  return [...value].length;
}
export function assertScalarLimit(value: string, limit: number, field: string): void {
  if (scalarLength(value) > limit) throw new Error(`${field} must be at most ${limit} characters`);
}
export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('und').replace(/\s+/g, ' ').trim();
}
export function normalizeTag(value: string): string {
  const result = normalizeSearch(value.trim());
  if (!result) throw new Error('Tag cannot be empty');
  assertScalarLimit(value.trim(), 100, 'Tag');
  return result;
}
export function visibleNoteText(markdown: string): string {
  return markdown
    .replace(markdownPunctuation, (_m, linkText) => linkText ?? ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function cleanMetadataText(value: string | undefined, limit: number): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? [...cleaned].slice(0, limit).join('') : null;
}
