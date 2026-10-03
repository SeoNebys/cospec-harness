// Search grammar: tokenizer + recursive-descent parser + evaluator (US4).
// Rules (from spec FR-013/014/015):
//   - Terms: quoted phrase ("..."), tag term (#tag), bare word.
//   - AND / OR / NOT are operators only when UNQUOTED; inside quotes they are
//     literal phrase text.
//   - Adjacent terms with no operator are combined with an implicit AND
//     (including a #tag next to a bare word).
//   - Precedence: NOT > AND (incl. implicit) > OR ; parentheses override.
//   - Matching is case-insensitive across title, description, note (plain
//     text), and address; #tag matches the tag set.
//   - Malformed queries (unbalanced quotes/parens) throw SearchQueryError.

export class SearchQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchQueryError';
    this.code = 'MALFORMED_QUERY';
  }
}

// ---- Tokenizer -------------------------------------------------------------

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }
    if (c === '"') {
      // Quoted phrase: everything up to the next quote is literal text,
      // including the words and/or/not.
      let j = i + 1;
      let text = '';
      while (j < n && input[j] !== '"') {
        text += input[j];
        j++;
      }
      if (j >= n) {
        throw new SearchQueryError('Unbalanced quotation marks');
      }
      tokens.push({ type: 'PHRASE', value: text });
      i = j + 1;
      continue;
    }
    if (c === '#') {
      // Tag term: #tag (letters/digits/-/_).
      let j = i + 1;
      let text = '';
      while (j < n && /[^\s()"]/.test(input[j])) {
        text += input[j];
        j++;
      }
      if (text === '') {
        // A lone '#' is treated as a bare word.
        tokens.push({ type: 'WORD', value: '#' });
      } else {
        tokens.push({ type: 'TAG', value: text });
      }
      i = j;
      continue;
    }
    // Bare word (delimited by space, parens, quotes).
    let j = i;
    let text = '';
    while (j < n && /[^\s()"]/.test(input[j])) {
      text += input[j];
      j++;
    }
    const upper = text.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: upper });
    } else {
      tokens.push({ type: 'WORD', value: text });
    }
    i = j;
  }

  return tokens;
}

// ---- Parser ----------------------------------------------------------------
// Grammar (precedence low → high):
//   orExpr   := andExpr (OR andExpr)*
//   andExpr  := notExpr ((AND | <implicit>) notExpr)*
//   notExpr  := NOT notExpr | atom
//   atom     := LPAREN orExpr RPAREN | term
//   term     := WORD | PHRASE | TAG

function parse(tokens) {
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'OR') {
      next();
      const right = parseAnd();
      node = { type: 'OR', left: node, right };
    }
    return node;
  }

  function isTermStart(t) {
    return (
      t &&
      (t.type === 'WORD' ||
        t.type === 'PHRASE' ||
        t.type === 'TAG' ||
        t.type === 'NOT' ||
        t.type === 'LPAREN')
    );
  }

  function parseAnd() {
    let node = parseNot();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === 'AND') {
        next();
        const right = parseNot();
        node = { type: 'AND', left: node, right };
      } else if (isTermStart(t)) {
        // Implicit AND between adjacent terms.
        const right = parseNot();
        node = { type: 'AND', left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  function parseNot() {
    if (peek() && peek().type === 'NOT') {
      next();
      return { type: 'NOT', operand: parseNot() };
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (!t) {
      throw new SearchQueryError('Unexpected end of query');
    }
    if (t.type === 'LPAREN') {
      next();
      const node = parseOr();
      if (!peek() || peek().type !== 'RPAREN') {
        throw new SearchQueryError('Unbalanced parentheses');
      }
      next();
      return node;
    }
    if (t.type === 'WORD') {
      next();
      return { type: 'TERM', kind: 'text', value: t.value };
    }
    if (t.type === 'PHRASE') {
      next();
      return { type: 'TERM', kind: 'phrase', value: t.value };
    }
    if (t.type === 'TAG') {
      next();
      return { type: 'TERM', kind: 'tag', value: t.value };
    }
    if (t.type === 'AND' || t.type === 'OR' || t.type === 'RPAREN') {
      throw new SearchQueryError(`Unexpected "${t.type}" in query`);
    }
    throw new SearchQueryError('Could not parse query');
  }

  const tree = parseOr();
  if (pos !== tokens.length) {
    throw new SearchQueryError('Unexpected trailing input in query');
  }
  return tree;
}

/** Parse a query string into an expression tree. Throws SearchQueryError. */
export function parseQuery(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null; // empty query matches everything
  return parse(tokens);
}

// ---- Evaluator -------------------------------------------------------------

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

/**
 * Build a normalised match context from a bookmark row (+ its tags).
 * `bookmark.tags` is an array of tag name strings.
 */
export function matchContext(bookmark) {
  const text = [
    bookmark.title || '',
    bookmark.description || '',
    stripHtml(bookmark.note_html || bookmark.noteHtml || ''),
    bookmark.url || '',
  ]
    .join('\n')
    .toLowerCase();
  const tags = (bookmark.tags || []).map((t) => String(t).toLowerCase());
  return { text, tags };
}

function evalNode(node, ctx) {
  switch (node.type) {
    case 'OR':
      return evalNode(node.left, ctx) || evalNode(node.right, ctx);
    case 'AND':
      return evalNode(node.left, ctx) && evalNode(node.right, ctx);
    case 'NOT':
      return !evalNode(node.operand, ctx);
    case 'TERM': {
      if (node.kind === 'tag') {
        return ctx.tags.includes(node.value.toLowerCase());
      }
      // text and phrase both do case-insensitive substring matching.
      return ctx.text.includes(node.value.toLowerCase());
    }
    default:
      throw new SearchQueryError('Invalid query node');
  }
}

/** Return true if a bookmark matches the parsed query tree (null = match). */
export function matches(tree, bookmark) {
  if (tree === null) return true;
  return evalNode(tree, matchContext(bookmark));
}
