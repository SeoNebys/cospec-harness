// Parse a comma-separated tag input into a clean list (trimmed, de-duplicated,
// lowercased). Tag suggestions (FR-012) and richer entry arrive in US3 (T045).

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const tag = part.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}
