import { LIMITS } from '../config/limits.js';

export type SearchExpression =
  | { type: 'text'; value: string }
  | { type: 'tag'; value: string }
  | { type: 'and'; left: SearchExpression; right: SearchExpression }
  | { type: 'or'; left: SearchExpression; right: SearchExpression };

export class SearchSyntaxError extends Error {
  constructor(message: string, public readonly start: number, public readonly end: number) { super(message); }
}

type Token = { type: 'value' | 'tag' | 'and' | 'or' | 'lparen' | 'rparen'; value?: string; start: number; end: number };

function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const fail = (message: string, start = index, end = Math.min(source.length, index + 1)): never => { throw new SearchSyntaxError(message, start, end); };
  while (index < source.length) {
    if (/\s/u.test(source[index]!)) { index++; continue; }
    const start = index;
    if (source[index] === '(') { tokens.push({ type: 'lparen', start, end: ++index }); continue; }
    if (source[index] === ')') { tokens.push({ type: 'rparen', start, end: ++index }); continue; }
    let isTag = false;
    if (source.slice(index, index + 4).toLowerCase() === 'tag:') { isTag = true; index += 4; }
    if (source[index] === '"') {
      index++;
      let value = '';
      while (index < source.length && source[index] !== '"') {
        if (source[index] === '\\') {
          const escaped = source[index + 1];
          if (escaped !== '"' && escaped !== '\\') fail('Only quotes and backslashes can be escaped.', index, index + 2);
          value += escaped; index += 2;
        } else {
          if (/\p{Cc}/u.test(source[index]!)) fail('Control characters are not allowed.', index, index + 1);
          value += source[index++];
        }
      }
      if (source[index] !== '"') fail('Close the quoted phrase.', start, source.length);
      index++;
      if (!value) fail(isTag ? 'A tag cannot be empty.' : 'A phrase cannot be empty.', start, index);
      tokens.push({ type: isTag ? 'tag' : 'value', value, start, end: index });
      continue;
    }
    const valueStart = index;
    while (index < source.length && !/[\s()"\\]/u.test(source[index]!)) index++;
    const value = source.slice(valueStart, index);
    if (!value) fail(isTag ? 'Add a tag after tag:.' : 'Unexpected character.', start, Math.max(start + 1, index));
    if (isTag) tokens.push({ type: 'tag', value, start, end: index });
    else if (/^AND$/iu.test(value)) tokens.push({ type: 'and', start, end: index });
    else if (/^OR$/iu.test(value)) tokens.push({ type: 'or', start, end: index });
    else tokens.push({ type: 'value', value, start, end: index });
  }
  return tokens;
}

export function parseSearch(source: string): SearchExpression | null {
  if ([...source].length > LIMITS.searchLength) throw new SearchSyntaxError(`Searches can be at most ${LIMITS.searchLength} characters.`, 0, source.length);
  const tokens = lex(source);
  if (!tokens.length) return null;
  let position = 0;
  let conditions = 0;
  const current = () => tokens[position];
  const fail = (message: string, token = current()): never => { throw new SearchSyntaxError(message, token?.start ?? source.length, token?.end ?? source.length); };
  const hasWhitespaceBetween = (left: Token, right: Token) => /\s/u.test(source.slice(left.end,right.start));
  const primary = (depth: number): SearchExpression => {
    if (depth > LIMITS.searchDepth) fail(`Searches can nest at most ${LIMITS.searchDepth} levels.`);
    const token = current();
    if (!token) fail('Add a search term.');
    if (token.type === 'lparen') {
      position++;
      if (current()?.type === 'rparen') fail('Parentheses cannot be empty.');
      const result = orExpression(depth + 1);
      if (current()?.type !== 'rparen') fail('Close the parenthesis.');
      position++;
      return result;
    }
    if (token.type !== 'value' && token.type !== 'tag') fail('Add a search term here.', token);
    position++;
    if (++conditions > LIMITS.searchConditions) fail(`Searches can contain at most ${LIMITS.searchConditions} conditions.`, token);
    return { type: token.type === 'tag' ? 'tag' : 'text', value: token.value! };
  };
  const andExpression = (depth: number): SearchExpression => {
    let left = primary(depth);
    while (position < tokens.length && current()!.type !== 'or' && current()!.type !== 'rparen') {
      const previous=tokens[position-1]!;
      if (current()!.type === 'and') { const operator=current()!;const next=tokens[position+1];if(!hasWhitespaceBetween(previous,operator)||!next||!hasWhitespaceBetween(operator,next))fail('Put spaces around AND.',operator);position++; }
      else if(!hasWhitespaceBetween(previous,current()!)) fail('Separate search conditions with a space.',current()!);
      const right = primary(depth);
      left = { type: 'and', left, right };
    }
    return left;
  };
  const orExpression = (depth: number): SearchExpression => {
    let left = andExpression(depth);
    while (current()?.type === 'or') {
      const operator=current()!;const previous=tokens[position-1]!;const next=tokens[position+1];if(!hasWhitespaceBetween(previous,operator)||!next||!hasWhitespaceBetween(operator,next))fail('Put spaces around OR.',operator);position++;
      left = { type: 'or', left, right: andExpression(depth) };
    }
    return left;
  };
  const expression = orExpression(0);
  if (position !== tokens.length) fail('Unexpected search input.');
  return expression;
}
