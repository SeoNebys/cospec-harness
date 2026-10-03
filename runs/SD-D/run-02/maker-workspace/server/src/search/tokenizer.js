// Tokenizer for the search grammar (contracts/search-grammar.md).
// Token kinds: 'word' | 'phrase' | 'tag' | 'and' | 'or' | 'not' | 'lparen' | 'rparen'
// Quoted content is literal (including AND/OR/NOT and #), producing a 'phrase'.

export class SearchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchError';
    this.code = 'invalid_query';
  }
}

export function tokenize(input) {
  const tokens = [];
  const s = input ?? '';
  let i = 0;
  const n = s.length;

  while (i < n) {
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
      // Quoted phrase — literal until the closing quote.
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < n) {
        if (s[j] === '"') {
          closed = true;
          break;
        }
        value += s[j];
        j++;
      }
      if (!closed) {
        throw new SearchError('Unterminated quote in search.');
      }
      tokens.push({ type: 'phrase', value });
      i = j + 1;
      continue;
    }

    // Bare run until whitespace or a paren or a quote.
    let j = i;
    let value = '';
    while (j < n && !/[\s()"]/.test(s[j])) {
      value += s[j];
      j++;
    }
    i = j;

    if (value.startsWith('#') && value.length > 1) {
      tokens.push({ type: 'tag', value: value.slice(1) });
    } else if (value === 'AND') {
      tokens.push({ type: 'and' });
    } else if (value === 'OR') {
      tokens.push({ type: 'or' });
    } else if (value === 'NOT') {
      tokens.push({ type: 'not' });
    } else {
      tokens.push({ type: 'word', value });
    }
  }

  return tokens;
}
