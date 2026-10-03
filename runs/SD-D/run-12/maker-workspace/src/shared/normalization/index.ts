export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('und');
}

export function normalizeTag(value: string): string {
  return normalizeSearch(value).trim().replace(/\s+/gu, ' ');
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value.trim());
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.toString();
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}
