// Tokenizer for the search query language (see contracts/search-grammar.md).

export class SearchSyntaxError extends Error {
  constructor(code, message) { super(message); this.name = 'SearchSyntaxError'; this.code = code; }
}

const OPERATORS = new Set(['AND', 'OR', 'NOT']);

/**
 * Produce a token stream. Token kinds:
 *   { type: 'lparen' } { type: 'rparen' }
 *   { type: 'op', value: 'AND'|'OR'|'NOT' }
 *   { type: 'tag', value }
 *   { type: 'term', value }   // word or quoted phrase (already a literal)
 */
export function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }

    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }

    // Quoted phrase -> always a literal term (even if it is an operator word).
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < s.length && s[j] !== '"') { value += s[j]; j++; }
      if (j >= s.length) throw new SearchSyntaxError('unbalanced-quote', 'Unbalanced quote in search query');
      tokens.push({ type: 'term', value });
      i = j + 1;
      continue;
    }

    // Tag term: #name
    if (ch === '#') {
      let j = i + 1;
      let value = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) { value += s[j]; j++; }
      if (value) tokens.push({ type: 'tag', value });
      i = j;
      continue;
    }

    // Bare word (may be an operator).
    let j = i;
    let value = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) { value += s[j]; j++; }
    i = j;
    if (OPERATORS.has(value.toUpperCase())) {
      tokens.push({ type: 'op', value: value.toUpperCase() });
    } else {
      tokens.push({ type: 'term', value });
    }
  }

  return tokens;
}
