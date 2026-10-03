// Tokenizer for the search grammar (contracts/search-grammar.md).
// Produces tokens: {type:'word'|'phrase'|'tag'|'and'|'or'|'not'|'lparen'|'rparen', value}
// Throws { code:'invalid_query', message } on unbalanced quotes.

const OPERATORS = new Set(['and', 'or', 'not']);

export function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }

    if (ch === '"') {
      // Quoted phrase: captured verbatim; operator words inside are literal text (FR-017c).
      const end = s.indexOf('"', i + 1);
      if (end === -1) {
        const err = new Error('Unbalanced quote in query.');
        err.code = 'invalid_query';
        throw err;
      }
      const value = s.slice(i + 1, end);
      tokens.push({ type: 'phrase', value });
      i = end + 1;
      continue;
    }

    if (ch === '#') {
      let j = i + 1;
      while (j < s.length && !/[\s()"]/.test(s[j])) j += 1;
      const value = s.slice(i + 1, j);
      if (value) tokens.push({ type: 'tag', value });
      i = j;
      continue;
    }

    // Bare run until whitespace or a structural char.
    let j = i;
    while (j < s.length && !/[\s()"]/.test(s[j])) j += 1;
    const raw = s.slice(i, j);
    const lower = raw.toLowerCase();
    if (OPERATORS.has(lower)) {
      tokens.push({ type: lower }); // and | or | not — case-insensitive (FR-017b)
    } else {
      tokens.push({ type: 'word', value: raw });
    }
    i = j;
  }

  return tokens;
}
