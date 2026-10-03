import type { SearchNode, SourceSpan } from '@shared/search.js';
import { AppError } from '@shared/errors.js';

type Token = {
  kind: 'word' | 'phrase' | 'tag' | 'and' | 'or' | 'not' | 'lparen' | 'rparen';
  value: string;
  span: SourceSpan;
};
export function tokenize(input: string): Token[] {
  if ([...input].length > 500)
    throw new AppError(422, 'QUERY_INVALID', 'Searches must be 500 characters or fewer.', {
      start: 0,
      end: input.length
    });
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/u.test(input[i]!)) {
      i++;
      continue;
    }
    const start = i;
    const ch = input[i]!;
    if (ch === '(' || ch === ')') {
      out.push({ kind: ch === '(' ? 'lparen' : 'rparen', value: ch, span: { start, end: ++i } });
      continue;
    }
    if (input.slice(i, i + 5).toLowerCase() === 'tag:"') {
      i += 5;
      let value = '';
      while (i < input.length && input[i] !== '"') value += input[i++]!;
      if (i >= input.length)
        throw new AppError(422, 'QUERY_INVALID', 'Close the quoted tag name.', {
          start,
          end: input.length
        });
      i++;
      if (!value.trim())
        throw new AppError(422, 'QUERY_INVALID', 'Add a tag name after tag:.', { start, end: i });
      out.push({ kind: 'tag', value, span: { start, end: i } });
      continue;
    }
    if (ch === '"') {
      i++;
      let value = '';
      while (i < input.length && input[i] !== '"') {
        value += input[i++]!;
      }
      if (i >= input.length)
        throw new AppError(
          422,
          'QUERY_INVALID',
          'Close the quoted phrase with another quotation mark.',
          { start, end: input.length }
        );
      i++;
      if (!value.trim())
        throw new AppError(422, 'QUERY_INVALID', 'Quoted phrases cannot be empty.', {
          start,
          end: i
        });
      out.push({ kind: 'phrase', value, span: { start, end: i } });
      continue;
    }
    let value = '';
    while (i < input.length && !/\s|\(|\)/u.test(input[i]!)) value += input[i++]!;
    if (value === 'AND' || value === 'OR' || value === 'NOT')
      out.push({
        kind: value.toLowerCase() as 'and' | 'or' | 'not',
        value,
        span: { start, end: i }
      });
    else if (value.toLowerCase().startsWith('tag:')) {
      let tag = value.slice(4);
      if (tag === '"') {
        tag = '';
        while (i < input.length && input[i] !== '"') tag += input[i++]!;
        if (input[i] !== '"')
          throw new AppError(422, 'QUERY_INVALID', 'Close the quoted tag name.', {
            start,
            end: input.length
          });
        i++;
      }
      if (!tag)
        throw new AppError(422, 'QUERY_INVALID', 'Add a tag name after tag:.', { start, end: i });
      out.push({ kind: 'tag', value: tag, span: { start, end: i } });
    } else out.push({ kind: 'word', value, span: { start, end: i } });
    if (out.length > 100)
      throw new AppError(422, 'QUERY_INVALID', 'Searches may contain at most 100 terms.', {
        start,
        end: i
      });
  }
  return out;
}
export function parseQuery(input: string): SearchNode | null {
  const tokens = tokenize(input);
  if (!tokens.length) return null;
  let index = 0;
  let depth = 0;
  const begins = (t: Token | undefined) =>
    !!t && ['word', 'phrase', 'tag', 'not', 'lparen'].includes(t.kind);
  const primary = (): SearchNode => {
    const t = tokens[index];
    if (!t) throw issue(input.length, input.length, 'Add a search term.');
    if (t.kind === 'lparen') {
      if (++depth > 10)
        throw issue(t.span.start, t.span.end, 'Parentheses may be nested at most 10 levels.');
      index++;
      const n = or();
      const close = tokens[index];
      if (close?.kind !== 'rparen')
        throw issue(t.span.start, input.length, 'Close this parenthesis.');
      index++;
      depth--;
      return { ...n, span: { start: t.span.start, end: close.span.end } };
    }
    if (['word', 'phrase', 'tag'].includes(t.kind)) {
      index++;
      return {
        type: t.kind === 'word' ? 'text' : (t.kind as 'phrase' | 'tag'),
        value: t.value,
        span: t.span
      };
    }
    throw issue(t.span.start, t.span.end, `“${t.value}” needs a term before it.`);
  };
  const unary = (): SearchNode => {
    const t = tokens[index];
    if (t?.kind === 'not') {
      index++;
      const child = unary();
      return { type: 'not', child, span: { start: t.span.start, end: child.span.end } };
    }
    return primary();
  };
  const and = (): SearchNode => {
    let left = unary();
    while (true) {
      const t = tokens[index];
      if (t?.kind === 'and') {
        index++;
        const right = unary();
        left = { type: 'and', left, right, span: { start: left.span.start, end: right.span.end } };
      } else if (begins(t)) {
        const right = unary();
        left = { type: 'and', left, right, span: { start: left.span.start, end: right.span.end } };
      } else break;
    }
    return left;
  };
  const or = (): SearchNode => {
    let left = and();
    while (tokens[index]?.kind === 'or') {
      index++;
      const right = and();
      left = { type: 'or', left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  };
  const ast = or();
  const extra = tokens[index];
  if (extra) throw issue(extra.span.start, extra.span.end, `Unexpected “${extra.value}”.`);
  return ast;
}
function issue(start: number, end: number, message: string) {
  return new AppError(422, 'QUERY_INVALID', message, { start, end });
}
