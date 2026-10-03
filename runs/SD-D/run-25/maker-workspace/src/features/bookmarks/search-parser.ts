export type SearchNode =
  | { type: "term"; value: string }
  | { type: "phrase"; value: string }
  | { type: "tag"; value: string }
  | { type: "not"; child: SearchNode }
  | { type: "and" | "or"; left: SearchNode; right: SearchNode };

type Token = { type: "word" | "phrase" | "and" | "or" | "not" | "lparen" | "rparen" | "tag"; value: string; offset: number };

export class SearchQueryError extends Error {
  constructor(message: string, public readonly offset: number, public readonly hint: string) {
    super(message);
    this.name = "SearchQueryError";
  }
}

function lex(input: string): Token[] {
  if ([...input].length > 1000) throw new SearchQueryError("Search queries can be at most 1,000 characters.", 1000, "Shorten the query and try again.");
  const tokens: Token[] = [];
  let i = 0;
  const push = (token: Token) => {
    tokens.push(token);
    if (tokens.length > 100) throw new SearchQueryError("Search queries can contain at most 100 tokens.", token.offset, "Remove a few conditions.");
  };
  while (i < input.length) {
    if (/\s/.test(input[i]!)) { i += 1; continue; }
    if (input.slice(i, i + 4).toLowerCase() === "tag:") {
      push({ type: "tag", value: "", offset: i });
      i += 4;
      continue;
    }
    if (input[i] === "(") { push({ type: "lparen", value: "(", offset: i++ }); continue; }
    if (input[i] === ")") { push({ type: "rparen", value: ")", offset: i++ }); continue; }
    if (input[i] === '"') {
      const start = i++;
      let value = "";
      let closed = false;
      while (i < input.length) {
        const char = input[i++]!;
        if (char === "\\" && i < input.length && ['"', "\\"].includes(input[i]!)) value += input[i++]!;
        else if (char === '"') { closed = true; break; }
        else value += char;
      }
      if (!closed) throw new SearchQueryError("Search phrase is not closed.", start, "Close the phrase with a quotation mark.");
      if (!value.trim()) throw new SearchQueryError("Search phrase is empty.", start, "Add words inside the quotation marks.");
      push({ type: "phrase", value, offset: start });
      continue;
    }
    const start = i;
    while (i < input.length && !/[\s()]/.test(input[i]!)) i += 1;
    const value = input.slice(start, i);
    const upper = value.toUpperCase();
    if (upper === "AND" || upper === "OR" || upper === "NOT") {
      push({ type: upper.toLowerCase() as "and" | "or" | "not", value, offset: start });
      continue;
    }
    push({ type: "word", value, offset: start });
  }
  return tokens;
}

export function parseSearchQuery(input: string): SearchNode | null {
  const tokens = lex(input.trim());
  if (!tokens.length) return null;
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary(): SearchNode {
    const token = take();
    if (!token) throw new SearchQueryError("Search query is incomplete.", input.length, "Add a search term.");
    if (token.type === "word") return { type: "term", value: token.value };
    if (token.type === "phrase") return { type: "phrase", value: token.value };
    if (token.type === "tag") {
      if (token.value) return { type: "tag", value: token.value };
      const value = take();
      if (!value || !["word", "phrase"].includes(value.type)) throw new SearchQueryError("Tag name is missing.", token.offset, "Add a tag name after tag:.");
      return { type: "tag", value: value.value };
    }
    if (token.type === "lparen") {
      depth += 1;
      if (depth > 10) throw new SearchQueryError("Search groups are nested too deeply.", token.offset, "Use no more than 10 nested groups.");
      if (peek()?.type === "rparen") throw new SearchQueryError("Search group is empty.", token.offset, "Add a search term inside the parentheses.");
      const node = orExpression();
      const close = take();
      depth -= 1;
      if (!close || close.type !== "rparen") throw new SearchQueryError("Search group is not closed.", token.offset, "Close the group with a parenthesis.");
      return node;
    }
    if (token.type === "rparen") throw new SearchQueryError("Unexpected closing parenthesis.", token.offset, "Remove it or add a matching opening parenthesis.");
    throw new SearchQueryError(`Add a search term ${token.type === "or" ? "before OR" : `after ${token.value}`}.`, token.offset, "Add a word, phrase, or tag condition.");
  }

  function unary(): SearchNode {
    if (peek()?.type === "not") { take(); return { type: "not", child: unary() }; }
    return primary();
  }

  const startsOperand = (token: Token | undefined) => token && ["word", "phrase", "tag", "lparen", "not"].includes(token.type);

  function andExpression(): SearchNode {
    let node = unary();
    while (peek()?.type === "and" || startsOperand(peek())) {
      if (peek()?.type === "and") take();
      node = { type: "and", left: node, right: unary() };
    }
    return node;
  }

  function orExpression(): SearchNode {
    let node = andExpression();
    while (peek()?.type === "or") { take(); node = { type: "or", left: node, right: andExpression() }; }
    return node;
  }

  const result = orExpression();
  const extra = peek();
  if (extra) throw new SearchQueryError("Search query has an unexpected token.", extra.offset, "Check the operators and parentheses near this position.");
  return result;
}
