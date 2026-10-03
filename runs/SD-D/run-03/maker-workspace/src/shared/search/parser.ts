import { searchParseError, tokenizeSearchQuery } from "./tokenizer.js";
import {
  type AndSearchNode,
  type EmptySearchNode,
  type OrSearchNode,
  type SearchAst,
  type SearchExpression,
  type SearchParseError,
  type SearchParseResult,
  SearchQuerySyntaxError,
  type SearchToken,
  type SourceRange,
} from "./types.js";

const EMPTY: EmptySearchNode = Object.freeze({ kind: "Empty" });

function sourceRange(start: number, end: number): SourceRange {
  return Object.freeze({ start, end });
}

function expressionRange(expression: SearchExpression): SourceRange {
  return expression.range;
}

function atomFromToken(token: SearchToken): SearchExpression {
  switch (token.kind) {
    case "text":
      return Object.freeze({ kind: "Text", value: token.value, range: token.range });
    case "phrase":
      return Object.freeze({ kind: "Phrase", value: token.value, range: token.range });
    case "tag":
      return Object.freeze({
        kind: "Tag",
        displayValue: token.displayValue,
        normalizedValue: token.normalizedValue,
        range: token.range,
      });
    case "and":
    case "or":
      throw new Error("An operator cannot be converted to a search atom.");
  }
}

function andNode(left: SearchExpression, right: SearchExpression): AndSearchNode {
  return Object.freeze({
    kind: "And",
    left,
    right,
    range: sourceRange(expressionRange(left).start, expressionRange(right).end),
  });
}

function orNode(left: SearchExpression, right: SearchExpression): OrSearchNode {
  return Object.freeze({
    kind: "Or",
    left,
    right,
    range: sourceRange(expressionRange(left).start, expressionRange(right).end),
  });
}

function isOperator(
  token: SearchToken | undefined,
): token is Extract<SearchToken, { kind: "and" | "or" }> {
  return token?.kind === "and" || token?.kind === "or";
}

function isParseError(value: SearchExpression | SearchParseError): value is SearchParseError {
  return "code" in value;
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: readonly SearchToken[]) {}

  parse(): SearchExpression | SearchParseError {
    const first = this.peek();
    if (first === undefined) throw new Error("Parser requires at least one token.");
    if (isOperator(first)) {
      return searchParseError("MISSING_LEFT_OPERAND", first.range.start, first.range.end);
    }

    let expression = this.parseAnd();
    if (isParseError(expression)) return expression;

    while (this.peek()?.kind === "or") {
      const operator = this.consume();
      const next = this.peek();
      if (next === undefined) {
        return searchParseError("MISSING_RIGHT_OPERAND", operator.range.start, operator.range.end);
      }
      if (isOperator(next)) {
        return searchParseError("DOUBLE_OPERATOR", next.range.start, next.range.end);
      }

      const right = this.parseAnd();
      if (isParseError(right)) return right;
      expression = orNode(expression, right);
    }

    return expression;
  }

  private parseAnd(): SearchExpression | SearchParseError {
    const first = this.consume();
    let expression = atomFromToken(first);

    while (true) {
      const token = this.peek();
      if (token === undefined || token.kind === "or") return expression;

      if (token.kind === "and") {
        const operator = this.consume();
        const next = this.peek();
        if (next === undefined) {
          return searchParseError(
            "MISSING_RIGHT_OPERAND",
            operator.range.start,
            operator.range.end,
          );
        }
        if (isOperator(next)) {
          return searchParseError("DOUBLE_OPERATOR", next.range.start, next.range.end);
        }
      }

      const rightToken = this.consume();
      if (isOperator(rightToken)) {
        return searchParseError("DOUBLE_OPERATOR", rightToken.range.start, rightToken.range.end);
      }
      expression = andNode(expression, atomFromToken(rightToken));
    }
  }

  private peek(): SearchToken | undefined {
    return this.tokens[this.cursor];
  }

  private consume(): SearchToken {
    const token = this.tokens[this.cursor];
    if (token === undefined) throw new Error("Unexpected end of token stream.");
    this.cursor += 1;
    return token;
  }
}

export function parseSearchQuery(source: string): SearchParseResult {
  const tokenized = tokenizeSearchQuery(source);
  if (!tokenized.ok) return tokenized;
  if (tokenized.tokens.length === 0) return Object.freeze({ ok: true, ast: EMPTY });

  const parsed = new Parser(tokenized.tokens).parse();
  if (isParseError(parsed)) {
    return Object.freeze({ ok: false, error: parsed });
  }
  return Object.freeze({ ok: true, ast: parsed });
}

export function parseSearchQueryOrThrow(source: string): SearchAst {
  const result = parseSearchQuery(source);
  if (!result.ok) throw new SearchQuerySyntaxError(result.error);
  return result.ast;
}
