// Tokenizer for the search grammar (FR-013/FR-013a/FR-013b).
//
// Token kinds: 'phrase' (quoted, always literal), 'word' (bareword),
// 'tag' (#tag), 'and'/'or'/'not' (operators), 'lparen', 'rparen'.
//
// Critically: AND / OR / NOT are treated as operators ONLY when they appear as
// bare words. Inside a quoted phrase they are literal text (FR-013b) and are
// emitted as a 'phrase' token.

const OPERATORS = new Set(['AND', 'OR', 'NOT']);

export class SearchSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SearchSyntaxError';
  }
}

export function tokenize(input) {
  const tokens = [];
  const s = String(input || '');
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Quoted phrase -> literal text (operators inside are NOT operators)
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < s.length && s[j] !== '"') {
        value += s[j];
        j++;
      }
      if (j >= s.length) {
        throw new SearchSyntaxError('Unterminated quoted phrase');
      }
      tokens.push({ type: 'phrase', value });
      i = j + 1;
      continue;
    }

    // Parentheses
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

    // Tag token: #tag
    if (ch === '#') {
      let j = i + 1;
      let value = '';
      while (j < s.length && !/[\s()"]/.test(s[j])) {
        value += s[j];
        j++;
      }
      if (value === '') {
        throw new SearchSyntaxError('Empty #tag token');
      }
      tokens.push({ type: 'tag', value });
      i = j;
      continue;
    }

    // Bareword: run until whitespace, paren, or quote
    let j = i;
    let word = '';
    while (j < s.length && !/[\s()"]/.test(s[j])) {
      word += s[j];
      j++;
    }
    i = j;

    const upper = word.toUpperCase();
    if (OPERATORS.has(upper)) {
      tokens.push({ type: upper.toLowerCase() });
    } else {
      tokens.push({ type: 'word', value: word });
    }
  }

  return tokens;
}
