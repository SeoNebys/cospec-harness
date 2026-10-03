// Evaluate a parsed search AST against a candidate bookmark.
// Candidate shape: { title, description, note_md, url, tagKeys: Set<string> }
// Matching is case-insensitive substring for words/phrases across
// title/description/note/url; tags match by shared identity (folded name).

import { foldTag } from '../models/tag.js';

export function matches(ast, bookmark) {
  if (ast == null) return true; // empty query matches everything
  switch (ast.type) {
    case 'word':
    case 'phrase':
      return fieldContains(bookmark, ast.value);
    case 'tag':
      return bookmark.tagKeys.has(foldTag(ast.value));
    case 'not':
      return !matches(ast.child, bookmark);
    case 'and':
      return matches(ast.left, bookmark) && matches(ast.right, bookmark);
    case 'or':
      return matches(ast.left, bookmark) || matches(ast.right, bookmark);
    default:
      return false;
  }
}

function fieldContains(bookmark, term) {
  const needle = String(term).toLowerCase();
  if (needle === '') return true;
  const fields = [bookmark.title, bookmark.description, bookmark.note_md, bookmark.url];
  for (const f of fields) {
    if (f && String(f).toLowerCase().includes(needle)) return true;
  }
  return false;
}
