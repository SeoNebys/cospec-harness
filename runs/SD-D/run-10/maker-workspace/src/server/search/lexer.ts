export type SearchToken = {
  type: 'word' | 'phrase' | 'tag' | 'and' | 'or' | 'not' | 'eof';
  value: string;
  start: number;
  end: number;
};

export class SearchSyntaxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly start: number,
    public readonly end: number,
    public readonly suggestion: string,
  ) {
    super(message);
  }
}

export function lexSearch(input: string): SearchToken[] {
  if ([...input].length > 2000) {
    throw new SearchSyntaxError(
      'Search is too long.',
      'too_long',
      2000,
      input.length,
      'Use 2,000 characters or fewer.',
    );
  }
  const tokens: SearchToken[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/u.test(input[index]!)) {
      index += 1;
      continue;
    }
    const start = index;
    if (input[index] === '"') {
      index += 1;
      const contentStart = index;
      while (index < input.length && input[index] !== '"') index += 1;
      if (index >= input.length) {
        throw new SearchSyntaxError(
          'The quoted phrase is not closed.',
          'unclosed_quote',
          start,
          input.length,
          'Add a closing double quote.',
        );
      }
      const value = input.slice(contentStart, index);
      index += 1;
      if (!value.trim()) {
        throw new SearchSyntaxError(
          'A quoted phrase cannot be empty.',
          'empty_phrase',
          start,
          index,
          'Add words between the quotes.',
        );
      }
      tokens.push({ type: 'phrase', value, start, end: index });
      continue;
    }
    if (input[index] === '#') {
      index += 1;
      const tagStart = index;
      while (index < input.length && /[\p{L}\p{N}_-]/u.test(input[index]!)) index += 1;
      if (index === tagStart || input[index] === '#') {
        throw new SearchSyntaxError(
          'Enter a valid tag after #.',
          'invalid_tag',
          start,
          Math.max(index + 1, start + 1),
          'Use # followed by a tag name.',
        );
      }
      tokens.push({ type: 'tag', value: input.slice(tagStart, index), start, end: index });
      continue;
    }
    if (input[index] === '(' || input[index] === ')') {
      throw new SearchSyntaxError(
        'Parentheses are not supported.',
        'unsupported_syntax',
        start,
        start + 1,
        'Remove the parenthesis.',
      );
    }
    while (
      index < input.length &&
      !/\s/u.test(input[index]!) &&
      !['"', '#', '(', ')'].includes(input[index]!)
    ) {
      index += 1;
    }
    const value = input.slice(start, index);
    const operator = value.toUpperCase();
    const type = operator === 'AND' ? 'and' : operator === 'OR' ? 'or' : operator === 'NOT' ? 'not' : 'word';
    tokens.push({ type, value, start, end: index });
  }
  tokens.push({ type: 'eof', value: '', start: input.length, end: input.length });
  return tokens;
}
