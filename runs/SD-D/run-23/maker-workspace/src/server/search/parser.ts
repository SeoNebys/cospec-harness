export type SearchNode =
  | { type: 'text'; value: string; start: number; end: number }
  | { type: 'phrase'; value: string; start: number; end: number }
  | { type: 'tag'; value: string; start: number; end: number }
  | { type: 'not'; child: SearchNode }
  | { type: 'and' | 'or'; children: SearchNode[] };

type Token = { type: 'term' | 'phrase' | 'tag' | 'and' | 'or' | 'not' | 'lp' | 'rp'; value: string; start: number; end: number };

export class SearchSyntaxError extends Error {
  constructor(message: string, public start: number, public end: number) { super(message); }
}

export function tokenize(query: string): Token[] {
  if (query.length > 1000) throw new SearchSyntaxError('Search is limited to 1,000 characters.', 1000, query.length);
  const tokens: Token[] = [];
  let i = 0;
  const quoted = (): { value: string; start: number; end: number } => {
    const start = i++;
    let value = '';
    while (i < query.length && query[i] !== '"') value += query[i++];
    if (query[i] !== '"') throw new SearchSyntaxError('Close the quoted phrase with another quotation mark.', start, query.length);
    i++;
    return { value, start, end: i };
  };
  while (i < query.length) {
    if (/\s/u.test(query[i])) { i++; continue; }
    const start = i;
    if (query[i] === '(') { tokens.push({ type: 'lp', value: '(', start, end: ++i }); continue; }
    if (query[i] === ')') { tokens.push({ type: 'rp', value: ')', start, end: ++i }); continue; }
    if (query[i] === '"') { const q = quoted(); tokens.push({ type: 'phrase', ...q }); continue; }
    if (query.slice(i, i + 4).toLowerCase() === 'tag:' && (i + 4 === query.length || !/\s/u.test(query[i + 4]))) {
      i += 4;
      let value = '';
      if (query[i] === '"') value = quoted().value;
      else while (i < query.length && !/[\s()]/u.test(query[i])) value += query[i++];
      if (!value) throw new SearchSyntaxError('Add a tag name after tag:.', start, i);
      tokens.push({ type: 'tag', value, start, end: i }); continue;
    }
    let value = '';
    while (i < query.length && !/[\s()]/u.test(query[i])) value += query[i++];
    const upper = value.toUpperCase();
    const type = upper === 'AND' ? 'and' : upper === 'OR' ? 'or' : upper === 'NOT' ? 'not' : 'term';
    tokens.push({ type, value, start, end: i });
    if (tokens.length > 100) throw new SearchSyntaxError('Search is limited to 100 terms and operators.', start, i);
  }
  return tokens;
}

export function parseSearch(query: string): SearchNode | null {
  const tokens = tokenize(query);
  if (!tokens.length) return null;
  let index = 0;
  let depth = 0;
  const peek = () => tokens[index];
  const startsPrimary = (t?: Token) => !!t && ['term', 'phrase', 'tag', 'lp', 'not'].includes(t.type);
  const primary = (): SearchNode => {
    const token = peek();
    if (!token) throw new SearchSyntaxError('The search ends before the expression is complete.', query.length, query.length);
    if (token.type === 'not') { index++; return { type: 'not', child: primary() }; }
    if (token.type === 'lp') {
      if (++depth > 10) throw new SearchSyntaxError('Search can use at most 10 levels of parentheses.', token.start, token.end);
      index++; const node = or();
      if (peek()?.type !== 'rp') throw new SearchSyntaxError('Close this parenthesized expression.', token.start, query.length);
      index++; depth--; return node;
    }
    if (token.type === 'term' || token.type === 'phrase' || token.type === 'tag') { index++; return { type: token.type === 'term' ? 'text' : token.type, value: token.value, start: token.start, end: token.end } as SearchNode; }
    throw new SearchSyntaxError(`Unexpected ${token.value || token.type}.`, token.start, token.end);
  };
  const and = (): SearchNode => {
    const children: SearchNode[] = [primary()];
    while (peek()?.type === 'and' || peek()?.type === 'not' || startsPrimary(peek())) {
      if (peek()?.type === 'and') { const op = tokens[index++]; if (!startsPrimary(peek())) throw new SearchSyntaxError('Add a term after AND.', op.start, op.end); }
      if (peek()?.type === 'not') { index++; children.push({ type: 'not', child: primary() }); }
      else children.push(primary());
    }
    return children.length === 1 ? children[0] : { type: 'and', children };
  };
  const or = (): SearchNode => {
    const children: SearchNode[] = [and()];
    while (peek()?.type === 'or') {
      const op = tokens[index++]; if (!startsPrimary(peek())) throw new SearchSyntaxError('Add a term after OR.', op.start, op.end);
      children.push(and());
    }
    return children.length === 1 ? children[0] : { type: 'or', children };
  };
  const result = or();
  if (index < tokens.length) throw new SearchSyntaxError(`Unexpected ${tokens[index].value}.`, tokens[index].start, tokens[index].end);
  return result;
}
