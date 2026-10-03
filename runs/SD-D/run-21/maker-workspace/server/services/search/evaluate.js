import { parse, SearchSyntaxError } from './parser.js';

// Builds a case-insensitive haystack for a bookmark: title, address,
// description, note text, and tags (FR-008).
export function haystack(bookmark) {
  const text = [
    bookmark.title,
    bookmark.url,
    bookmark.description,
    bookmark.note_text || bookmark.noteText,
  ]
    .filter(Boolean)
    .join('  ')
    .toLowerCase();
  const tags = (bookmark.tags || []).map((t) => String(t).toLowerCase());
  return { text, tags };
}

function evalNode(node, h) {
  if (!node) return true; // empty query matches everything
  switch (node.op) {
    case 'and':
      return evalNode(node.left, h) && evalNode(node.right, h);
    case 'or':
      return evalNode(node.left, h) || evalNode(node.right, h);
    case 'not':
      return !evalNode(node.child, h);
    case 'term':
      return h.text.includes(String(node.value).toLowerCase());
    case 'tag':
      return h.tags.includes(String(node.value).toLowerCase());
    default:
      return true;
  }
}

// Compiles a query into a predicate over serialized/raw bookmarks.
// Throws SearchSyntaxError on malformed queries (FR-009).
export function compileQuery(query) {
  const tree = parse(query);
  return (bookmark) => evalNode(tree, haystack(bookmark));
}

export { SearchSyntaxError };
