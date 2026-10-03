// Tokenizer for the rich search language (contracts/search-grammar.md).
// AND/OR/NOT are operators only when unquoted; inside quotes they are literal
// phrase text. Supports #tag, "quoted phrases", parentheses, and bare terms.

export type TokenType = 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'TAG' | 'PHRASE' | 'TERM';

export interface Token {
  type: TokenType;
  value: string; // for TAG/PHRASE/TERM
}

export class SearchSyntaxError extends Error {}

const OPERATORS: Record<string, TokenType> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    if (c === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (c === '"') {
      // Quoted phrase: everything up to the next quote is literal text.
      let j = i + 1;
      let text = '';
      while (j < n && input[j] !== '"') {
        text += input[j];
        j++;
      }
      if (j >= n) throw new SearchSyntaxError('Unbalanced quote in search expression.');
      tokens.push({ type: 'PHRASE', value: text });
      i = j + 1;
      continue;
    }

    if (c === '#') {
      // Tag token: #name (letters/digits/-/_/. until whitespace or paren).
      let j = i + 1;
      let name = '';
      while (j < n && !/[\s()"]/.test(input[j])) {
        name += input[j];
        j++;
      }
      if (name.length === 0) throw new SearchSyntaxError('Empty #tag in search expression.');
      tokens.push({ type: 'TAG', value: name });
      i = j;
      continue;
    }

    // Bare word: read until whitespace, paren, or quote.
    let j = i;
    let word = '';
    while (j < n && !/[\s()"]/.test(input[j])) {
      word += input[j];
      j++;
    }
    i = j;

    const upper = word.toUpperCase();
    if (OPERATORS[upper]) {
      tokens.push({ type: OPERATORS[upper], value: upper });
    } else {
      tokens.push({ type: 'TERM', value: word });
    }
  }

  return tokens;
}
