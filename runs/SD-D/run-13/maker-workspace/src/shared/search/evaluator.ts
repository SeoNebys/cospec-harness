import type { SearchExpression } from './parser.js';
import { normalizeTag } from '../tags/normalize-tag.js';

export interface SearchableBookmark { title: string; url: string; description: string | null; notesText: string; tags: string[] }
const fold = (value: string) => value.normalize('NFKC').toLocaleLowerCase('und');

export function matchesSearch(expression: SearchExpression | null, item: SearchableBookmark): boolean {
  if (!expression) return true;
  if (expression.type === 'and' || expression.type === 'or') {
    return expression.type === 'and'
      ? matchesSearch(expression.left, item) && matchesSearch(expression.right, item)
      : matchesSearch(expression.left, item) || matchesSearch(expression.right, item);
  }
  if (expression.type === 'tag') return item.tags.some((tag) => normalizeTag(tag) === normalizeTag(expression.value));
  const needle = fold(expression.value);
  return [item.title, item.url, item.description || '', item.notesText, ...item.tags].some((field) => fold(field).includes(needle));
}
