// Evaluate a parsed AST against a bookmark (research Decision 4).
// Text matching is case-insensitive substring over title+description+note+url.
// #tag matches tag membership (case-insensitive).

export function searchableText(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.note, bookmark.url]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function evaluate(ast, bookmark) {
  if (!ast) return true; // empty query matches all
  const text = searchableText(bookmark);
  const tags = new Set((bookmark.tags || []).map((t) => t.toLowerCase()));
  return evalNode(ast, text, tags);
}

function evalNode(node, text, tags) {
  if (node.term === 'word' || node.term === 'phrase') {
    return text.includes(node.value.toLowerCase());
  }
  if (node.term === 'tag') {
    return tags.has(node.value.toLowerCase());
  }
  if (node.op === 'not') return !evalNode(node.child, text, tags);
  if (node.op === 'and') {
    return evalNode(node.left, text, tags) && evalNode(node.right, text, tags);
  }
  if (node.op === 'or') {
    return evalNode(node.left, text, tags) || evalNode(node.right, text, tags);
  }
  return false;
}
