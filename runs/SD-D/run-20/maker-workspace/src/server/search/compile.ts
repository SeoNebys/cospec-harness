import type { SearchNode } from './parse.js';

export interface SearchableBookmark {
  title: string;
  url: string;
  description: string | null;
  noteText: string;
  tags: Array<{ label: string }>;
}

const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
const tokenizedText = (value: string): string =>
  (normalizeText(value).match(/[\p{L}\p{N}_]+/gu) ?? []).join(' ');
export const normalizeTag = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase();

export function compileSearch(ast: SearchNode | null): (bookmark: SearchableBookmark) => boolean {
  if (!ast) return () => true;
  const evaluate = (node: SearchNode, bookmark: SearchableBookmark): boolean => {
    if (node.type === 'and') return evaluate(node.left, bookmark) && evaluate(node.right, bookmark);
    if (node.type === 'or') return evaluate(node.left, bookmark) || evaluate(node.right, bookmark);
    if (node.type === 'not') return !evaluate(node.child, bookmark);
    if (!('value' in node)) return false;
    if (node.type === 'tag')
      return bookmark.tags.some((tag) => normalizeTag(tag.label) === normalizeTag(node.value));
    const fields = [
      bookmark.title,
      bookmark.url,
      bookmark.description ?? '',
      bookmark.noteText,
      ...bookmark.tags.map((tag) => tag.label),
    ];
    if (node.type === 'phrase') {
      const phrase = tokenizedText(node.value);
      return fields.some((field) => tokenizedText(field).includes(phrase));
    }
    const terms = tokenizedText(node.value).split(' ').filter(Boolean);
    return fields.some((field) => {
      const searchable = tokenizedText(field);
      return terms.every((term) => searchable.includes(term));
    });
  };
  return (bookmark) => evaluate(ast, bookmark);
}
