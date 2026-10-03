// Recursive-descent parser building a boolean AST from search tokens.
// Grammar (precedence NOT > AND (incl. implicit) > OR), per contracts/search-grammar.md:
//   or   := and ( OR and )*
//   and  := not ( (AND)? not )*        // adjacent operands => implicit AND (FR-017a)
//   not  := NOT not | atom
//   atom := '(' or ')' | term
// AST nodes:
//   {op:'or'|'and', left, right} | {op:'not', child} | {op:'term', term:{type,value}}
import { tokenize } from './tokenizer.js';

function invalid(message) {
  const err = new Error(message);
  err.code = 'invalid_query';
  return err;
}

const OPERAND_START = new Set(['word', 'phrase', 'tag', 'not', 'lparen']);

export function parseQuery(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null; // empty query = no text constraint

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'or') {
      next();
      const right = parseAnd();
      node = { op: 'or', left: node, right };
    }
    return node;
  }

  function parseAnd() {
    let node = parseNot();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.type === 'and') {
        next();
        const right = parseNot();
        node = { op: 'and', left: node, right };
      } else if (OPERAND_START.has(t.type)) {
        // Adjacent operand with no operator => implicit AND (FR-017a).
        const right = parseNot();
        node = { op: 'and', left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  function parseNot() {
    if (peek() && peek().type === 'not') {
      next();
      const child = parseNot();
      return { op: 'not', child };
    }
    return parseAtom();
  }

  function parseAtom() {
    const t = peek();
    if (!t) throw invalid('Unexpected end of query; an operand is missing.');
    if (t.type === 'lparen') {
      next();
      const inner = parseOr();
      const close = next();
      if (!close || close.type !== 'rparen') throw invalid('Unbalanced parentheses in query.');
      return inner;
    }
    if (t.type === 'rparen') throw invalid('Unbalanced parentheses in query.');
    if (t.type === 'and' || t.type === 'or' || t.type === 'not') {
      throw invalid(`Operator "${t.type.toUpperCase()}" is missing an operand.`);
    }
    // word | phrase | tag
    next();
    return { op: 'term', term: { type: t.type, value: t.value } };
  }

  const ast = parseOr();
  if (pos !== tokens.length) throw invalid('Unbalanced parentheses in query.');
  return ast;
}
