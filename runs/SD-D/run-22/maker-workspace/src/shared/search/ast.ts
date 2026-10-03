export const MAX_SEARCH_QUERY_LENGTH = 1_000;
export const MAX_SEARCH_CLAUSES = 50;

export type TextClause = {
  type: 'text';
  value: string;
  exact: boolean;
};

export type TagAnyClause = {
  type: 'tagAny';
  values: string[];
};

export type SearchClause = TextClause | TagAnyClause;

export type SearchAst = {
  type: 'and';
  clauses: SearchClause[];
};

export type SearchParseErrorCode =
  | 'UNCLOSED_QUOTE'
  | 'EMPTY_TAG'
  | 'EMPTY_GROUP'
  | 'MISSING_ALTERNATIVE'
  | 'UNEXPECTED_RPAREN'
  | 'INVALID_ESCAPE'
  | 'QUERY_TOO_LONG'
  | 'TOO_MANY_CLAUSES';

export type CharacterSpan = { start: number; end: number };

const ERROR_MESSAGES: Record<SearchParseErrorCode, string> = {
  UNCLOSED_QUOTE: 'Close the quoted phrase with a double quote.',
  EMPTY_TAG: 'Enter a tag after tag:.',
  EMPTY_GROUP: 'Add at least one tag inside the group.',
  MISSING_ALTERNATIVE: 'Enter a tag on both sides of |.',
  UNEXPECTED_RPAREN: 'Remove the unexpected closing parenthesis.',
  INVALID_ESCAPE: 'Only reserved punctuation can be escaped.',
  QUERY_TOO_LONG: `Search queries can contain at most ${MAX_SEARCH_QUERY_LENGTH} characters.`,
  TOO_MANY_CLAUSES: `Search queries can contain at most ${MAX_SEARCH_CLAUSES} conditions.`,
};

export class SearchParseError extends Error {
  readonly code: SearchParseErrorCode;
  readonly span: CharacterSpan;

  constructor(code: SearchParseErrorCode, span: CharacterSpan, message = ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'SearchParseError';
    this.code = code;
    this.span = span;
  }

  toJSON() {
    return { code: this.code, message: this.message, span: this.span };
  }
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('und');
}

export function normalizeTagValue(value: string): string {
  return normalizeSearchText(value).trim().replace(/\s+/gu, ' ');
}
