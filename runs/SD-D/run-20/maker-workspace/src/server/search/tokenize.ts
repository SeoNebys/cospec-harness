export type TokenType = 'TERM' | 'PHRASE' | 'TAG' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'EOF';
export interface SearchToken {
  type: TokenType;
  value: string;
  offset: number;
  length: number;
}

export class SearchSyntaxError extends Error {
  constructor(
    public query: string,
    public offset: number,
    public length: number,
    message: string,
    public expected: string[] = [],
  ) {
    super(message);
  }
}

function quoted(query: string, start: number): { value: string; end: number } {
  let value = '';
  for (let index = start + 1; index < query.length; index += 1) {
    const character = query[index]!;
    if (character === '"') return { value, end: index + 1 };
    if (character === '\\') {
      const next = query[index + 1];
      if (next !== '"' && next !== '\\')
        throw new SearchSyntaxError(query, index, 2, 'Only quote and backslash may be escaped.', [
          '\\"',
          '\\\\',
        ]);
      value += next;
      index += 1;
    } else value += character;
  }
  throw new SearchSyntaxError(
    query,
    start,
    Math.max(1, query.length - start),
    'This quoted value is missing its closing quote.',
    ['"'],
  );
}

export function tokenize(query: string): SearchToken[] {
  if (query.length > 500)
    throw new SearchSyntaxError(query, 500, query.length - 500, 'Searches may be at most 500 characters.');
  const tokens: SearchToken[] = [];
  let index = 0;
  while (index < query.length) {
    if (/\s/u.test(query[index]!)) {
      index += 1;
      continue;
    }
    const start = index;
    const character = query[index]!;
    if (character === '(' || character === ')') {
      tokens.push({
        type: character === '(' ? 'LPAREN' : 'RPAREN',
        value: character,
        offset: index,
        length: 1,
      });
      index += 1;
      continue;
    }
    if (character === '"') {
      const result = quoted(query, index);
      if (!result.value)
        throw new SearchSyntaxError(query, start, result.end - start, 'Quoted phrases cannot be empty.');
      tokens.push({ type: 'PHRASE', value: result.value, offset: start, length: result.end - start });
      index = result.end;
      continue;
    }
    if (character === '#') {
      index += 1;
      if (query[index] === '"') {
        const result = quoted(query, index);
        if (!result.value.trim())
          throw new SearchSyntaxError(query, start, result.end - start, 'Tags cannot be empty.');
        tokens.push({ type: 'TAG', value: result.value, offset: start, length: result.end - start });
        index = result.end;
        continue;
      }
      while (index < query.length && !/\s|[()]/u.test(query[index]!)) index += 1;
      const value = query.slice(start + 1, index);
      if (!value) throw new SearchSyntaxError(query, start, 1, 'A # must be followed by a tag.', ['tag']);
      tokens.push({ type: 'TAG', value, offset: start, length: index - start });
      continue;
    }
    while (index < query.length && !/\s|[()]/u.test(query[index]!)) index += 1;
    const value = query.slice(start, index);
    const upper = value.toUpperCase();
    tokens.push({
      type: ['AND', 'OR', 'NOT'].includes(upper) ? (upper as TokenType) : 'TERM',
      value,
      offset: start,
      length: index - start,
    });
    if (tokens.length > 100)
      throw new SearchSyntaxError(query, start, index - start, 'Searches may contain at most 100 tokens.');
  }
  if (tokens.length > 100)
    throw new SearchSyntaxError(query, query.length - 1, 1, 'Searches may contain at most 100 tokens.');
  tokens.push({ type: 'EOF', value: '', offset: query.length, length: 1 });
  return tokens;
}
