export type SearchNode = { type: "term" | "phrase" | "tag" | "status"; value: string } | { type: "not"; child: SearchNode } | { type: "and" | "or"; children: SearchNode[] };
export class SearchSyntaxError extends Error { constructor(message: string, public start: number, public end: number, public suggestion: string) { super(message); } }
type Token = { value: string; pos: number; quoted?: boolean };
function lex(source: string): Token[] {
  const out: Token[] = []; let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if ("()-".includes(source[i])) { out.push({ value: source[i], pos: i++ }); continue; }
    if (source[i] === '"') {
      const start = i++; let value = ""; let closed = false;
      while (i < source.length) { if (source[i] === "\\" && i + 1 < source.length) { value += source[i + 1]; i += 2; } else if (source[i] === '"') { i++; closed = true; break; } else value += source[i++]; }
      if (!closed) throw new SearchSyntaxError("Unclosed quoted phrase", start, source.length, "Add a closing quote.");
      if (!value) throw new SearchSyntaxError("Quoted phrases cannot be empty", start, i, "Add words between the quotes.");
      out.push({ value, pos: start, quoted: true }); continue;
    }
    const start = i; while (i < source.length && !/[\s()\-"]/.test(source[i])) i++;
    out.push({ value: source.slice(start, i), pos: start });
  }
  return out;
}
export function parseSearch(source: string): SearchNode | null {
  const tokens = lex(source); if (!tokens.length) return null; let at = 0;
  const primary = (): SearchNode => {
    const t = tokens[at]; if (!t) throw new SearchSyntaxError("Expected a search term", source.length, source.length, "Add a word or phrase.");
    if (t.value === "(") { at++; const n = or(); if (tokens[at]?.value !== ")") throw new SearchSyntaxError("Unclosed group", t.pos, source.length, "Add a closing parenthesis."); at++; return n; }
    if (t.value === ")") throw new SearchSyntaxError("Unexpected closing parenthesis", t.pos, t.pos + 1, "Remove it or add an opening parenthesis.");
    at++;
    const field = t.value.match(/^(tag|is):(.*)$/i);
    if (field) {
      let value = field[2]; if (!value && tokens[at]?.quoted) value = tokens[at++].value;
      if (!value) throw new SearchSyntaxError(`Missing ${field[1]} value`, t.pos, t.pos + t.value.length, "Add a value after the colon.");
      if (field[1].toLowerCase() === "is" && !["read", "unread", "active", "archived"].includes(value.toLowerCase())) throw new SearchSyntaxError("Unknown status", t.pos, t.pos + t.value.length, "Use read, unread, active, or archived.");
      return { type: field[1].toLowerCase() === "tag" ? "tag" : "status", value: value.toLowerCase() };
    }
    if (/^[a-z]+:/i.test(t.value)) throw new SearchSyntaxError("Unknown search field", t.pos, t.pos + t.value.length, "Use tag: or is:.");
    return { type: t.quoted ? "phrase" : "term", value: t.value };
  };
  const unary = (): SearchNode => tokens[at]?.value === "-" ? (at++, { type: "not", child: unary() }) : primary();
  const and = (): SearchNode => { const nodes = [unary()]; while (at < tokens.length && tokens[at].value !== ")" && tokens[at].value.toUpperCase() !== "OR") { if (tokens[at].value.toUpperCase() === "AND") { at++; if (!tokens[at]) throw new SearchSyntaxError("Dangling AND", tokens[at - 1].pos, source.length, "Add another condition."); } nodes.push(unary()); } return nodes.length === 1 ? nodes[0] : { type: "and", children: nodes }; };
  const or = (): SearchNode => { const nodes = [and()]; while (tokens[at]?.value.toUpperCase() === "OR") { const p = tokens[at++].pos; if (!tokens[at]) throw new SearchSyntaxError("Dangling OR", p, source.length, "Add another condition."); nodes.push(and()); } return nodes.length === 1 ? nodes[0] : { type: "or", children: nodes }; };
  const result = or(); if (at !== tokens.length) throw new SearchSyntaxError("Unexpected search input", tokens[at].pos, tokens[at].pos + tokens[at].value.length, "Review this part of the query."); return result;
}
export function describeSearch(node: SearchNode | null): string[] {
  if (!node) return [];
  if (node.type === "and" || node.type === "or") return [`${node.type.toUpperCase()} group`, ...node.children.flatMap(describeSearch)];
  if (node.type === "not") return describeSearch(node.child).map(x => `NOT ${x}`);
  if (node.type === "term" || node.type === "phrase" || node.type === "tag" || node.type === "status") return [`${node.type}: ${node.value}`];
  return [];
}
