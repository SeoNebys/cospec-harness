export const SEARCH_GRAMMAR_VERSION = 1 as const;

/** UTF-16 source offsets, with an inclusive start and exclusive end. */
export interface SourceRange {
  readonly start: number;
  readonly end: number;
}

export type SearchParseErrorCode =
  | "UNMATCHED_QUOTE"
  | "EMPTY_PHRASE"
  | "EMPTY_TAG"
  | "MISSING_LEFT_OPERAND"
  | "MISSING_RIGHT_OPERAND"
  | "DOUBLE_OPERATOR"
  | "UNSUPPORTED_GROUPING"
  | "UNSUPPORTED_NEGATION"
  | "INVALID_ESCAPE";

export interface SearchParseError {
  readonly code: SearchParseErrorCode;
  readonly message: string;
  readonly hint: string;
  readonly range: SourceRange;
}

export interface EmptySearchNode {
  readonly kind: "Empty";
}

export interface TextSearchNode {
  readonly kind: "Text";
  readonly value: string;
  readonly range: SourceRange;
}

export interface PhraseSearchNode {
  readonly kind: "Phrase";
  readonly value: string;
  readonly range: SourceRange;
}

export interface TagSearchNode {
  readonly kind: "Tag";
  readonly normalizedValue: string;
  readonly displayValue: string;
  readonly range: SourceRange;
}

export interface AndSearchNode {
  readonly kind: "And";
  readonly left: SearchExpression;
  readonly right: SearchExpression;
  readonly range: SourceRange;
}

export interface OrSearchNode {
  readonly kind: "Or";
  readonly left: SearchExpression;
  readonly right: SearchExpression;
  readonly range: SourceRange;
}

export type SearchExpression =
  | TextSearchNode
  | PhraseSearchNode
  | TagSearchNode
  | AndSearchNode
  | OrSearchNode;

export type SearchAst = EmptySearchNode | SearchExpression;

export type SearchParseResult =
  | { readonly ok: true; readonly ast: SearchAst }
  | { readonly ok: false; readonly error: SearchParseError };

export type SearchToken =
  | {
      readonly kind: "text";
      readonly value: string;
      readonly range: SourceRange;
    }
  | {
      readonly kind: "phrase";
      readonly value: string;
      readonly range: SourceRange;
    }
  | {
      readonly kind: "tag";
      readonly normalizedValue: string;
      readonly displayValue: string;
      readonly range: SourceRange;
    }
  | { readonly kind: "and"; readonly range: SourceRange }
  | { readonly kind: "or"; readonly range: SourceRange };

export type SearchTokenizeResult =
  | { readonly ok: true; readonly tokens: readonly SearchToken[] }
  | { readonly ok: false; readonly error: SearchParseError };

export class SearchQuerySyntaxError extends Error {
  readonly code: SearchParseErrorCode;
  readonly hint: string;
  readonly range: SourceRange;

  constructor(readonly detail: SearchParseError) {
    super(detail.message);
    this.name = "SearchQuerySyntaxError";
    this.code = detail.code;
    this.hint = detail.hint;
    this.range = detail.range;
  }
}
