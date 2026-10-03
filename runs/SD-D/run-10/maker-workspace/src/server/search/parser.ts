import { lexSearch, SearchSyntaxError, type SearchToken } from './lexer.js';

export type SearchAst =
  | { type: 'text'; value: string; phrase: boolean }
  | { type: 'tag'; value: string }
  | { type: 'not'; child: SearchAst }
  | { type: 'and' | 'or'; left: SearchAst; right: SearchAst };

export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export function parseSearch(input: string): SearchAst | null {
  const tokens = lexSearch(input.trim());
  let position = 0;
  const current = () => tokens[position]!;
  const take = () => tokens[position++]!;
  const startsOperand = (token: SearchToken) => ['word', 'phrase', 'tag', 'not'].includes(token.type);

  const operand = (): SearchAst => {
    const token = current();
    if (token.type === 'not') {
      take();
      if (!startsOperand(current())) missingOperand(token);
      return { type: 'not', child: operand() };
    }
    if (token.type === 'word' || token.type === 'phrase') {
      take();
      return { type: 'text', value: token.value, phrase: token.type === 'phrase' };
    }
    if (token.type === 'tag') {
      take();
      return { type: 'tag', value: normalizeTagName(token.value) };
    }
    throw new SearchSyntaxError(
      'Expected a search term.',
      'missing_operand',
      token.start,
      token.end,
      'Add a word, phrase, or #tag.',
    );
  };

  const andExpression = (): SearchAst => {
    let node = operand();
    while (current().type === 'and' || startsOperand(current())) {
      if (current().type === 'and') {
        const operator = take();
        if (!startsOperand(current())) missingOperand(operator);
      }
      node = { type: 'and', left: node, right: operand() };
    }
    return node;
  };

  const orExpression = (): SearchAst => {
    let node = andExpression();
    while (current().type === 'or') {
      const operator = take();
      if (!startsOperand(current())) missingOperand(operator);
      node = { type: 'or', left: node, right: andExpression() };
    }
    return node;
  };

  if (current().type === 'eof') return null;
  const result = orExpression();
  if (current().type !== 'eof') {
    const token = current();
    throw new SearchSyntaxError(
      `Unexpected ${token.value || 'input'}.`,
      'unexpected_token',
      token.start,
      token.end,
      'Remove or complete the operator.',
    );
  }
  return result;
}

function missingOperand(operator: SearchToken): never {
  throw new SearchSyntaxError(
    `Expected a term after ${operator.value.toUpperCase()}.`,
    'missing_operand',
    operator.start,
    operator.end,
    `Add a word, phrase, or #tag after ${operator.value.toUpperCase()}.`,
  );
}
