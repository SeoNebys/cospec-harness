export function normalizeTags(values, established = []) {
  const byKey = new Map();
  for (const tag of established) {
    const cleaned = cleanTag(tag);
    if (cleaned) byKey.set(cleaned.toLocaleLowerCase(), cleaned);
  }
  const result = [];
  for (const value of values ?? []) {
    const cleaned = cleanTag(value);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase();
    const spelling = byKey.get(key) ?? cleaned;
    if (!result.some(tag => tag.toLocaleLowerCase() === key)) result.push(spelling);
    if (!byKey.has(key)) byKey.set(key, spelling);
  }
  return result;
}

export function suggestTags(allTags, query, selected = []) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return [];
  const selectedKeys = new Set(selected.map(tag => tag.toLocaleLowerCase()));
  return normalizeTags(allTags).filter(tag =>
    !selectedKeys.has(tag.toLocaleLowerCase()) && tag.toLocaleLowerCase().includes(needle));
}

function cleanTag(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}
