// Tokenizer for the search query language (research.md §6, FR-009).
// Token types: term (bare word), phrase (quoted, exact), tag (#tag),
// and, or, not, lparen, rparen.
// Quoted operator words (e.g. "AND") are literal phrase terms, not operators.

const OPERATORS = new Set(['and', 'or', 'not']);

export function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === '"') {
      // Quoted phrase — exact, and always a literal term even if it is AND/OR/NOT.
      let j = i + 1;
      let value = '';
      while (j < s.length && s[j] !== '"') {
        value += s[j];
        j++;
      }
      if (j >= s.length) {
        throw new SearchSyntaxError('Unbalanced quote in search query.');
      }
      tokens.push({ type: 'phrase', value });
      i = j + 1;
      continue;
    }
    if (ch === '#') {
      let j = i + 1;
      let value = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) {
        value += s[j];
        j++;
      }
      if (value) tokens.push({ type: 'tag', value });
      i = j;
      continue;
    }
    // Bare word (until whitespace, paren, or quote).
    let j = i;
    let value = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) {
      value += s[j];
      j++;
    }
    i = j;
    const lower = value.toLowerCase();
    if (OPERATORS.has(lower)) {
      tokens.push({ type: lower });
    } else {
      tokens.push({ type: 'term', value });
    }
  }
  return tokens;
}

export class SearchSyntaxError extends Error {}
