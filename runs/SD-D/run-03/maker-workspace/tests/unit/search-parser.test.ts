import { describe, expect, it } from "vitest";

import { parseSearchQuery, parseSearchQueryOrThrow } from "../../src/shared/search/parser.js";
import { tokenizeSearchQuery } from "../../src/shared/search/tokenizer.js";
import type {
  SearchAst,
  SearchParseError,
  SearchParseResult,
  SourceRange,
} from "../../src/shared/search/types.js";

function parse(source: string): SearchAst {
  return parseSearchQueryOrThrow(source);
}

function failure(source: string): SearchParseError {
  const result: SearchParseResult = parseSearchQuery(source);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error(`Expected ${JSON.stringify(source)} to be invalid`);
  return result.error;
}

function range(start: number, end: number): SourceRange {
  return { start, end };
}

describe("search grammar version 1 lexer", () => {
  it("emits atoms, case-insensitive operators, and stable end-exclusive source ranges", () => {
    expect(tokenizeSearchQuery('  Alpha aNd "two words" OR #news #"machine learning"  ')).toEqual({
      ok: true,
      tokens: [
        { kind: "text", value: "Alpha", range: range(2, 7) },
        { kind: "and", range: range(8, 11) },
        { kind: "phrase", value: "two words", range: range(12, 23) },
        { kind: "or", range: range(24, 26) },
        {
          kind: "tag",
          displayValue: "news",
          normalizedValue: "news",
          range: range(27, 32),
        },
        {
          kind: "tag",
          displayValue: "machine learning",
          normalizedValue: "machine learning",
          range: range(33, 52),
        },
      ],
    });
  });

  it("decodes only supported quote and backslash escapes", () => {
    expect(parse('"say \\"hello\\" \\\\ path"')).toMatchObject({
      kind: "Phrase",
      value: 'say "hello" \\ path',
      range: range(0, 23),
    });
  });

  it.each([
    ['"bad\\nvalue"', range(4, 6)],
    ['#"bad\\tvalue"', range(5, 7)],
    ['"trailing\\', range(9, 10)],
  ])("rejects an invalid quoted escape in %j", (source, expectedRange) => {
    expect(failure(source)).toEqual({
      code: "INVALID_ESCAPE",
      message: "Quoted text can escape only a quote or backslash.",
      hint: "Escape only a quote or backslash",
      range: expectedRange,
    });
  });
});

describe("search grammar version 1 parser", () => {
  it.each(["", " ", "\n\t "])("returns an immutable Empty AST for %j", (source) => {
    const ast = parse(source);
    expect(ast).toEqual({ kind: "Empty" });
    expect(Object.isFrozen(ast)).toBe(true);
  });

  it("parses each atom and preserves decoded display spelling", () => {
    expect(parse("Alpha")).toEqual({ kind: "Text", value: "Alpha", range: range(0, 5) });
    expect(parse('"Alpha beta"')).toEqual({
      kind: "Phrase",
      value: "Alpha beta",
      range: range(0, 12),
    });
    expect(parse("#NeWs")).toEqual({
      kind: "Tag",
      displayValue: "NeWs",
      normalizedValue: "news",
      range: range(0, 5),
    });
    expect(parse('#" Machine\tLearning "')).toEqual({
      kind: "Tag",
      displayValue: "Machine Learning",
      normalizedValue: "machine learning",
      range: range(0, 21),
    });
  });

  it("normalizes exact-tag keys with Unicode compatibility and locale-independent case", () => {
    expect(parse('#"  ＮＥＷＳ   Café  "')).toMatchObject({
      kind: "Tag",
      displayValue: "ＮＥＷＳ Café",
      normalizedValue: "news café",
    });
  });

  it("treats adjacent atoms as AND", () => {
    expect(parse("alpha beta")).toEqual({
      kind: "And",
      left: { kind: "Text", value: "alpha", range: range(0, 5) },
      right: { kind: "Text", value: "beta", range: range(6, 10) },
      range: range(0, 10),
    });
  });

  it("accepts explicit case-insensitive AND", () => {
    expect(parse("alpha aNd beta")).toMatchObject({
      kind: "And",
      left: { kind: "Text", value: "alpha" },
      right: { kind: "Text", value: "beta" },
      range: range(0, 14),
    });
  });

  it("binds explicit and implicit AND more tightly than OR", () => {
    expect(parse("alpha OR beta gamma")).toMatchObject({
      kind: "Or",
      left: { kind: "Text", value: "alpha" },
      right: {
        kind: "And",
        left: { kind: "Text", value: "beta" },
        right: { kind: "Text", value: "gamma" },
      },
      range: range(0, 19),
    });

    expect(parse("alpha AND beta OR gamma")).toMatchObject({
      kind: "Or",
      left: {
        kind: "And",
        left: { kind: "Text", value: "alpha" },
        right: { kind: "Text", value: "beta" },
      },
      right: { kind: "Text", value: "gamma" },
    });
  });

  it("parses the remaining contract precedence examples", () => {
    expect(parse('"alpha beta" #news')).toMatchObject({
      kind: "And",
      left: { kind: "Phrase", value: "alpha beta" },
      right: { kind: "Tag", normalizedValue: "news" },
    });
    expect(parse('#news OR #"machine learning"')).toMatchObject({
      kind: "Or",
      left: { kind: "Tag", normalizedValue: "news" },
      right: { kind: "Tag", normalizedValue: "machine learning" },
    });
    expect(parse('"AND" OR "OR"')).toMatchObject({
      kind: "Or",
      left: { kind: "Phrase", value: "AND" },
      right: { kind: "Phrase", value: "OR" },
    });
  });

  it("freezes every AST node and range", () => {
    const ast = parse("alpha beta OR #news");
    expect(Object.isFrozen(ast)).toBe(true);
    if (ast.kind !== "Or") throw new Error("Expected Or node");
    expect(Object.isFrozen(ast.range)).toBe(true);
    expect(Object.isFrozen(ast.left)).toBe(true);
    expect(Object.isFrozen(ast.right)).toBe(true);
    if (ast.left.kind !== "And") throw new Error("Expected And node");
    expect(Object.isFrozen(ast.left.left)).toBe(true);
    expect(Object.isFrozen(ast.left.right)).toBe(true);
  });
});

describe("search syntax guidance", () => {
  it.each([
    ['"alpha', "UNMATCHED_QUOTE", range(0, 6), "Close the quoted phrase"],
    ['#"alpha', "UNMATCHED_QUOTE", range(1, 7), "Close the quoted phrase"],
    ['""', "EMPTY_PHRASE", range(0, 2), "Add text inside the quotes"],
    ['"  \t"', "EMPTY_PHRASE", range(0, 5), "Add text inside the quotes"],
    ["#", "EMPTY_TAG", range(0, 1), "Add a tag name after `#`"],
    ['#""', "EMPTY_TAG", range(0, 3), "Add a tag name after `#`"],
    ['#" \t"', "EMPTY_TAG", range(0, 5), "Add a tag name after `#`"],
    ["OR alpha", "MISSING_LEFT_OPERAND", range(0, 2), "Add a search term before the operator"],
    ["and alpha", "MISSING_LEFT_OPERAND", range(0, 3), "Add a search term before the operator"],
    ["alpha AND", "MISSING_RIGHT_OPERAND", range(6, 9), "Add a search term after the operator"],
    ["alpha or  ", "MISSING_RIGHT_OPERAND", range(6, 8), "Add a search term after the operator"],
    [
      "alpha AND OR beta",
      "DOUBLE_OPERATOR",
      range(10, 12),
      "Remove one operator or add a term between them",
    ],
    [
      "alpha OR AND beta",
      "DOUBLE_OPERATOR",
      range(9, 12),
      "Remove one operator or add a term between them",
    ],
    [
      "(alpha OR beta)",
      "UNSUPPORTED_GROUPING",
      range(0, 1),
      "Remove parentheses; `AND` already binds before `OR`",
    ],
    [
      "alpha)",
      "UNSUPPORTED_GROUPING",
      range(5, 6),
      "Remove parentheses; `AND` already binds before `OR`",
    ],
    ["NOT alpha", "UNSUPPORTED_NEGATION", range(0, 3), "Negation is not supported"],
    ["not alpha", "UNSUPPORTED_NEGATION", range(0, 3), "Negation is not supported"],
    ["-alpha", "UNSUPPORTED_NEGATION", range(0, 6), "Negation is not supported"],
    ["alpha -beta", "UNSUPPORTED_NEGATION", range(6, 11), "Negation is not supported"],
  ] as const)(
    "returns %s for %j with a stable range and required hint",
    (source, code, expectedRange, hint) => {
      expect(failure(source)).toMatchObject({ code, range: expectedRange, hint });
    },
  );

  it("never exposes a partial AST for invalid input", () => {
    const result = parseSearchQuery("valid AND OR trailing");
    expect(result).toEqual({
      ok: false,
      error: {
        code: "DOUBLE_OPERATOR",
        message: "Two operators cannot appear together.",
        hint: "Remove one operator or add a term between them",
        range: range(10, 12),
      },
    });
    expect("ast" in result).toBe(false);
  });
});

describe("adversarial parser behavior", () => {
  it("terminates on a long valid flat expression without recursive parsing", () => {
    const source = Array.from({ length: 10_000 }, (_, index) => `t${index}`).join(" ");
    const result = parseSearchQuery(source);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ast.kind).toBe("And");
  });

  it("terminates on a long unterminated quote with a bounded error", () => {
    const source = `"${"a".repeat(100_000)}`;
    expect(failure(source)).toMatchObject({
      code: "UNMATCHED_QUOTE",
      range: range(0, source.length),
    });
  });
});
