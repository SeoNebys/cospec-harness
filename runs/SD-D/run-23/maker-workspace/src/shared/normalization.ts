export function normalizeName(value: string): { display: string; key: string } {
  const display = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return { display, key: display.toLocaleLowerCase('und') };
}

export function normalizeEmail(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function titleSortKey(value: string): string {
  return normalizeName(value).key;
}

export function plainTextFromMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
