import type {
  SearchParseError,
  SearchParseErrorCode,
  SearchToken,
  SearchTokenizeResult,
  SourceRange,
} from "./types.js";

const HINTS = {
  UNMATCHED_QUOTE: "Close the quoted phrase",
  EMPTY_PHRASE: "Add text inside the quotes",
  EMPTY_TAG: "Add a tag name after `#`",
  MISSING_LEFT_OPERAND: "Add a search term before the operator",
  MISSING_RIGHT_OPERAND: "Add a search term after the operator",
  DOUBLE_OPERATOR: "Remove one operator or add a term between them",
  UNSUPPORTED_GROUPING: "Remove parentheses; `AND` already binds before `OR`",
  UNSUPPORTED_NEGATION: "Negation is not supported",
  INVALID_ESCAPE: "Escape only a quote or backslash",
} as const satisfies Record<SearchParseErrorCode, string>;

const MESSAGES = {
  UNMATCHED_QUOTE: "The quoted phrase is not closed.",
  EMPTY_PHRASE: "A quoted phrase must contain text.",
  EMPTY_TAG: "An exact tag expression must include a tag name.",
  MISSING_LEFT_OPERAND: "The operator needs a search term before it.",
  MISSING_RIGHT_OPERAND: "The operator needs a search term after it.",
  DOUBLE_OPERATOR: "Two operators cannot appear together.",
  UNSUPPORTED_GROUPING: "Parentheses are not supported in search grammar version 1.",
  UNSUPPORTED_NEGATION: "Negation is not supported in search grammar version 1.",
  INVALID_ESCAPE: "Quoted text can escape only a quote or backslash.",
} as const satisfies Record<SearchParseErrorCode, string>;

function sourceRange(start: number, end: number): SourceRange {
  return Object.freeze({ start, end });
}

export function searchParseError(
  code: SearchParseErrorCode,
  start: number,
  end: number,
): SearchParseError {
  return Object.freeze({
    code,
    message: MESSAGES[code],
    hint: HINTS[code],
    range: sourceRange(start, end),
  });
}

/**
 * Normalization used for exact tag identity. Display spelling is deliberately
 * kept separate by tag tokens.
 */
export function normalizeExactTag(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("und");
}

function cleanTagDisplay(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

interface QuotedSuccess {
  readonly ok: true;
  readonly value: string;
  readonly end: number;
}

interface QuotedFailure {
  readonly ok: false;
  readonly error: SearchParseError;
}

function readQuoted(source: string, quoteStart: number): QuotedSuccess | QuotedFailure {
  const decoded: string[] = [];
  let cursor = quoteStart + 1;

  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '"') {
      return { ok: true, value: decoded.join(""), end: cursor + 1 };
    }

    if (character === "\\") {
      const escaped = source[cursor + 1];
      if (escaped === undefined) {
        return { ok: false, error: searchParseError("INVALID_ESCAPE", cursor, cursor + 1) };
      }
      if (escaped !== '"' && escaped !== "\\") {
        return { ok: false, error: searchParseError("INVALID_ESCAPE", cursor, cursor + 2) };
      }
      decoded.push(escaped);
      cursor += 2;
      continue;
    }

    decoded.push(character ?? "");
    cursor += 1;
  }

  return {
    ok: false,
    error: searchParseError("UNMATCHED_QUOTE", quoteStart, source.length),
  };
}

function frozenToken<T extends SearchToken>(token: T): T {
  return Object.freeze(token);
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/u.test(character);
}

function operatorKind(value: string): "and" | "or" | null {
  const normalized = value.toLocaleUpperCase("en-US");
  if (normalized === "AND") return "and";
  if (normalized === "OR") return "or";
  return null;
}

/** A linear lexer for the deliberately small, non-grouping grammar. */
export function tokenizeSearchQuery(source: string): SearchTokenizeResult {
  const tokens: SearchToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isWhitespace(source[cursor])) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    const character = source[cursor];

    if (character === "(" || character === ")") {
      return {
        ok: false,
        error: searchParseError("UNSUPPORTED_GROUPING", start, start + 1),
      };
    }

    if (character === '"') {
      const quoted = readQuoted(source, start);
      if (!quoted.ok) return quoted;
      if (quoted.value.trim() === "") {
        return {
          ok: false,
          error: searchParseError("EMPTY_PHRASE", start, quoted.end),
        };
      }
      tokens.push(
        frozenToken({
          kind: "phrase",
          value: quoted.value,
          range: sourceRange(start, quoted.end),
        }),
      );
      cursor = quoted.end;
      continue;
    }

    if (character === "#") {
      cursor += 1;
      if (cursor >= source.length || isWhitespace(source[cursor])) {
        return { ok: false, error: searchParseError("EMPTY_TAG", start, start + 1) };
      }

      let rawValue: string;
      if (source[cursor] === '"') {
        const quoted = readQuoted(source, cursor);
        if (!quoted.ok) return quoted;
        rawValue = quoted.value;
        cursor = quoted.end;
        if (rawValue.trim() === "") {
          return { ok: false, error: searchParseError("EMPTY_TAG", start, cursor) };
        }
      } else {
        const valueStart = cursor;
        while (
          cursor < source.length &&
          !isWhitespace(source[cursor]) &&
          source[cursor] !== "(" &&
          source[cursor] !== ")"
        ) {
          cursor += 1;
        }
        rawValue = source.slice(valueStart, cursor);
        if (rawValue === "") {
          return { ok: false, error: searchParseError("EMPTY_TAG", start, start + 1) };
        }
      }

      const displayValue = cleanTagDisplay(rawValue);
      tokens.push(
        frozenToken({
          kind: "tag",
          displayValue,
          normalizedValue: normalizeExactTag(displayValue),
          range: sourceRange(start, cursor),
        }),
      );
      continue;
    }

    while (
      cursor < source.length &&
      !isWhitespace(source[cursor]) &&
      source[cursor] !== '"' &&
      source[cursor] !== "(" &&
      source[cursor] !== ")"
    ) {
      cursor += 1;
    }
    const value = source.slice(start, cursor);

    if (value.startsWith("-")) {
      return {
        ok: false,
        error: searchParseError("UNSUPPORTED_NEGATION", start, cursor),
      };
    }
    if (value.toLocaleUpperCase("en-US") === "NOT") {
      return {
        ok: false,
        error: searchParseError("UNSUPPORTED_NEGATION", start, cursor),
      };
    }

    const kind = operatorKind(value);
    const tokenRange = sourceRange(start, cursor);
    tokens.push(
      kind === null
        ? frozenToken({ kind: "text", value, range: tokenRange })
        : frozenToken({ kind, range: tokenRange }),
    );
  }

  return Object.freeze({ ok: true, tokens: Object.freeze(tokens) });
}
