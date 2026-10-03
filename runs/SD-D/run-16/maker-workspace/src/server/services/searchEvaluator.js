// Evaluate a parsed search AST against a bookmark record.
// Free-text terms match case-insensitively across title, description, note, address.
// #tag terms match tag membership (case-insensitive, exact tag name).

function haystack(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.note, bookmark.address]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function evaluate(ast, bookmark) {
  if (!ast) return true; // empty query matches everything
  switch (ast.type) {
    case 'term':
      return haystack(bookmark).includes(String(ast.value).toLowerCase());
    case 'tag': {
      const want = String(ast.value).toLowerCase();
      return (bookmark.tags || []).some((t) => t.toLowerCase() === want);
    }
    case 'and':
      return evaluate(ast.left, bookmark) && evaluate(ast.right, bookmark);
    case 'or':
      return evaluate(ast.left, bookmark) || evaluate(ast.right, bookmark);
    case 'not':
      return !evaluate(ast.operand, bookmark);
    default:
      return true;
  }
}

// Filter and sort a list of bookmarks by a query string.
export function runSearch(parseFn, bookmarks, queryText) {
  const ast = parseFn(queryText);
  return bookmarks.filter((b) => evaluate(ast, b));
}
