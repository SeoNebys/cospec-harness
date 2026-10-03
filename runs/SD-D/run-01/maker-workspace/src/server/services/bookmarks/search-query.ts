export class SearchQueryError extends Error {}
export function parseSearchQuery(input: string): string | undefined {
  const value = input.trim(); if (!value) return undefined;
  const atoms: string[] = []; let index = 0;
  while (index < value.length) {
    while (/\s/.test(value[index] ?? '')) index++;
    if (index >= value.length) break;
    if (value[index] === '"') {
      const end = value.indexOf('"', index + 1); if (end < 0) throw new SearchQueryError('Close the quotation mark to search an exact phrase.');
      const phrase = value.slice(index + 1,end).trim(); if (phrase) atoms.push(`"${phrase.replaceAll('"','""')}"`); index=end+1;
    } else {
      let end=index; while (end < value.length && !/\s/.test(value[end]!)) end++;
      const word=value.slice(index,end).replace(/["*:^(){}]/g,'').replaceAll('[','').replaceAll(']','').trim(); if (word) atoms.push(`"${word.replaceAll('"','""')}"`); index=end;
    }
  }
  return atoms.length ? atoms.join(' AND ') : undefined;
}
