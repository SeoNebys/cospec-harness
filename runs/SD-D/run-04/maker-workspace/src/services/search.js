// Advanced search (FR-017/018/019/020).
//
// Supports: case-insensitive matching across title/description/note/address/tags;
// quoted "exact phrases" (AND/OR/NOT inside quotes are literal text); #tag terms;
// boolean AND / OR / NOT with parentheses; implicit AND between adjacent terms.
// A malformed query throws SearchQueryError (surfaced as HTTP 400).

export class SearchQueryError extends Error {}

// --- Tokenizer -------------------------------------------------------------

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = input;
  while (i < s.length) {
    const c = s[i];
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
      // Quoted phrase: everything until the closing quote is literal.
      let j = i + 1;
      let text = '';
      while (j < s.length && s[j] !== '"') {
        text += s[j];
        j++;
      }
      if (j >= s.length) {
        throw new SearchQueryError('Unterminated quoted phrase');
      }
      tokens.push({ type: 'PHRASE', value: text });
      i = j + 1;
      continue;
    }
    if (c === '#') {
      // #tag term: read until whitespace or paren.
      let j = i + 1;
      let name = '';
      while (j < s.length && !/[\s()]/.test(s[j])) {
        name += s[j];
        j++;
      }
      if (name === '') {
        throw new SearchQueryError('Empty #tag term');
      }
      tokens.push({ type: 'TAG', value: name });
      i = j;
      continue;
    }
    // Bare word: read until whitespace or paren (quotes/# handled above).
    let j = i;
    let word = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) {
      word += s[j];
      j++;
    }
    const upper = word.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      tokens.push({ type: upper });
    } else {
      tokens.push({ type: 'WORD', value: word });
    }
    i = j;
  }
  return tokens;
}

// --- Parser (recursive descent) -------------------------------------------
// expression := orExpr
// orExpr      := andExpr (OR andExpr)*
// andExpr     := notExpr ((AND | implicit) notExpr)*
// notExpr     := NOT notExpr | primary
// primary     := '(' expression ')' | PHRASE | TAG | WORD

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  parse() {
    if (this.tokens.length === 0) return null;
    const node = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new SearchQueryError('Unexpected token in query');
    }
    return node;
  }
  parseOr() {
    let left = this.parseAnd();
    while (this.peek() && this.peek().type === 'OR') {
      this.next();
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }
  parseAnd() {
    let left = this.parseNot();
    while (this.peek()) {
      const t = this.peek().type;
      if (t === 'AND') {
        this.next();
        const right = this.parseNot();
        left = { type: 'and', left, right };
      } else if (t === 'OR' || t === 'RPAREN') {
        break;
      } else {
        // Implicit AND between adjacent terms.
        const right = this.parseNot();
        left = { type: 'and', left, right };
      }
    }
    return left;
  }
  parseNot() {
    if (this.peek() && this.peek().type === 'NOT') {
      this.next();
      return { type: 'not', operand: this.parseNot() };
    }
    return this.parsePrimary();
  }
  parsePrimary() {
    const t = this.peek();
    if (!t) throw new SearchQueryError('Unexpected end of query');
    if (t.type === 'LPAREN') {
      this.next();
      const inner = this.parseOr();
      const close = this.next();
      if (!close || close.type !== 'RPAREN') {
        throw new SearchQueryError('Missing closing parenthesis');
      }
      if (inner === null) throw new SearchQueryError('Empty parentheses');
      return inner;
    }
    if (t.type === 'PHRASE') {
      this.next();
      return { type: 'phrase', value: t.value };
    }
    if (t.type === 'TAG') {
      this.next();
      return { type: 'tag', value: t.value };
    }
    if (t.type === 'WORD') {
      this.next();
      return { type: 'word', value: t.value };
    }
    throw new SearchQueryError(`Unexpected token: ${t.type}`);
  }
}

export function parseQuery(input) {
  if (!input || input.trim() === '') return null;
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}

// --- Evaluator -------------------------------------------------------------
// doc: { title, description, note_text, url, tags: string[] }

function textHaystack(doc) {
  return [doc.title, doc.description, doc.note_text, doc.url]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function evaluate(node, doc) {
  if (node === null) return true;
  switch (node.type) {
    case 'and':
      return evaluate(node.left, doc) && evaluate(node.right, doc);
    case 'or':
      return evaluate(node.left, doc) || evaluate(node.right, doc);
    case 'not':
      return !evaluate(node.operand, doc);
    case 'phrase':
    case 'word': {
      const needle = node.value.toLowerCase();
      if (needle === '') return true;
      const tags = (doc.tags || []).map((t) => t.toLowerCase());
      return textHaystack(doc).includes(needle) || tags.some((t) => t.includes(needle));
    }
    case 'tag': {
      const needle = node.value.toLowerCase();
      const tags = (doc.tags || []).map((t) => t.toLowerCase());
      return tags.includes(needle);
    }
    default:
      return false;
  }
}

// Convenience: compile a query once, return a predicate over docs.
export function compile(input) {
  const ast = parseQuery(input);
  return (doc) => evaluate(ast, doc);
}
