import { SearchSyntaxError, tokenize, type SearchToken } from './tokenize.js';

export type SearchNode =
  | { type: 'text' | 'phrase' | 'tag'; value: string }
  | { type: 'not'; child: SearchNode }
  | { type: 'and' | 'or'; left: SearchNode; right: SearchNode };

export interface ParsedSearch {
  query: string;
  ast: SearchNode | null;
}

export function parseSearch(query: string): ParsedSearch {
  if (!query.trim()) return { query, ast: null };
  const tokens = tokenize(query);
  let position = 0;
  let depth = 0;
  const current = (): SearchToken => tokens[position]!;
  const consume = (): SearchToken => tokens[position++]!;
  const error = (message: string, expected: string[] = []): never => {
    const token = current();
    throw new SearchSyntaxError(query, token.offset, Math.max(1, token.length), message, expected);
  };
  const startsUnary = (token: SearchToken): boolean =>
    ['TERM', 'PHRASE', 'TAG', 'NOT', 'LPAREN'].includes(token.type);
  const primary = (): SearchNode => {
    const token = consume();
    if (token.type === 'TERM') return { type: 'text', value: token.value };
    if (token.type === 'PHRASE') return { type: 'phrase', value: token.value };
    if (token.type === 'TAG') return { type: 'tag', value: token.value };
    if (token.type === 'LPAREN') {
      depth += 1;
      if (depth > 10)
        throw new SearchSyntaxError(query, token.offset, 1, 'Search groups may be nested at most 10 levels.');
      if (current().type === 'RPAREN') error('Parentheses cannot be empty.', ['term', 'phrase', 'tag']);
      const node = orExpression();
      if (current().type !== 'RPAREN') error('This group is missing a closing parenthesis.', [')']);
      consume();
      depth -= 1;
      return node;
    }
    throw new SearchSyntaxError(
      query,
      token.offset,
      Math.max(1, token.length),
      'A search value is required here.',
      ['term', 'phrase', 'tag', '('],
    );
  };
  const unary = (): SearchNode =>
    current().type === 'NOT' ? (consume(), { type: 'not', child: unary() }) : primary();
  const andExpression = (): SearchNode => {
    let node = unary();
    while (current().type === 'AND' || startsUnary(current())) {
      if (current().type === 'AND') {
        consume();
        if (!startsUnary(current()))
          error('AND needs a search value on its right.', ['term', 'phrase', 'tag', 'NOT', '(']);
      }
      node = { type: 'and', left: node, right: unary() };
    }
    return node;
  };
  const orExpression = (): SearchNode => {
    let node = andExpression();
    while (current().type === 'OR') {
      consume();
      if (!startsUnary(current()))
        error('OR needs a search value on its right.', ['term', 'phrase', 'tag', 'NOT', '(']);
      node = { type: 'or', left: node, right: andExpression() };
    }
    return node;
  };
  const ast = orExpression();
  if (current().type !== 'EOF')
    error(
      current().type === 'RPAREN'
        ? 'This closing parenthesis has no matching opening parenthesis.'
        : 'Unexpected search token.',
    );
  return { query, ast };
}

export { SearchSyntaxError } from './tokenize.js';
