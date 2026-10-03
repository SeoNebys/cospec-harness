import {
  MAX_SEARCH_CLAUSES,
  MAX_SEARCH_QUERY_LENGTH,
  SearchParseError,
  normalizeSearchText,
  normalizeTagValue,
  type SearchAst,
  type SearchClause,
} from './ast.js';

const RESERVED = new Set(['"', '\\', '(', ')', '|']);

class Parser {
  private position = 0;
  private parsedClauseCount = 0;

  constructor(private readonly input: string) {}

  parse(): SearchAst {
    const clauses: SearchClause[] = [];
    const seen = new Set<string>();
    this.skipWhitespace();

    while (!this.atEnd()) {
      if (this.peek() === ')') {
        throw new SearchParseError('UNEXPECTED_RPAREN', this.spanHere());
      }
      const clause = this.isTagPrefix() ? this.parseTagClause() : this.parseTextClause();
      this.parsedClauseCount += 1;
      if (this.parsedClauseCount > MAX_SEARCH_CLAUSES) {
        throw new SearchParseError('TOO_MANY_CLAUSES', { start: this.position, end: this.position });
      }
      const key = clause.type === 'text'
        ? `text:${clause.exact}:${clause.value}`
        : `tag:${clause.values.join('\u0000')}`;
      if (!seen.has(key)) {
        seen.add(key);
        clauses.push(clause);
      }
      if (!this.atEnd() && !this.isWhitespace(this.peek())) {
        if (this.peek() === ')') throw new SearchParseError('UNEXPECTED_RPAREN', this.spanHere());
      }
      this.skipWhitespace();
    }
    return { type: 'and', clauses };
  }

  private parseTextClause(): SearchClause {
    if (this.peek() === '"') {
      return { type: 'text', value: normalizeSearchText(this.parseQuoted()), exact: true };
    }
    return { type: 'text', value: normalizeSearchText(this.parseBare(false)), exact: false };
  }

  private parseTagClause(): SearchClause {
    this.position += 4;
    if (this.atEnd() || this.isWhitespace(this.peek())) {
      throw new SearchParseError('EMPTY_TAG', { start: this.position - 4, end: this.position });
    }
    if (this.peek() !== '(') {
      const value = this.peek() === '"' ? this.parseQuoted() : this.parseBare(true);
      const normalized = normalizeTagValue(value);
      if (!normalized) throw new SearchParseError('EMPTY_TAG', { start: this.position, end: this.position });
      return { type: 'tagAny', values: [normalized] };
    }

    const groupStart = this.position++;
    if (this.peek() === ')') {
      this.position++;
      throw new SearchParseError('EMPTY_GROUP', { start: groupStart, end: this.position });
    }
    const values: string[] = [];
    const seen = new Set<string>();
    while (true) {
      this.skipWhitespace();
      if (this.atEnd()) {
        throw new SearchParseError('MISSING_ALTERNATIVE', { start: this.position, end: this.position });
      }
      if (this.peek() === '|' || this.peek() === ')') {
        throw new SearchParseError(
          values.length === 0 && this.peek() === ')' ? 'EMPTY_GROUP' : 'MISSING_ALTERNATIVE',
          this.spanHere(),
        );
      }
      const value = this.peek() === '"' ? this.parseQuoted() : this.parseBare(true, true);
      const normalized = normalizeTagValue(value);
      if (!normalized) throw new SearchParseError('MISSING_ALTERNATIVE', this.spanHere());
      if (!seen.has(normalized)) {
        seen.add(normalized);
        values.push(normalized);
      }
      this.skipWhitespace();
      if (this.peek() === ')') {
        this.position++;
        return { type: 'tagAny', values };
      }
      if (this.peek() !== '|') {
        throw new SearchParseError('MISSING_ALTERNATIVE', this.spanHere());
      }
      const separator = this.position++;
      this.skipWhitespace();
      if (this.atEnd() || this.peek() === ')' || this.peek() === '|') {
        throw new SearchParseError('MISSING_ALTERNATIVE', {
          start: separator,
          end: Math.min(this.input.length, this.position + 1),
        });
      }
    }
  }

  private parseQuoted(): string {
    const start = this.position++;
    let value = '';
    while (!this.atEnd()) {
      const character = this.peek();
      if (character === '"') {
        this.position++;
        return value;
      }
      if (character === '\\') {
        value += this.parseEscape();
      } else {
        value += character;
        this.position++;
      }
    }
    throw new SearchParseError('UNCLOSED_QUOTE', { start, end: this.input.length });
  }

  private parseBare(tag: boolean, inGroup = false): string {
    const start = this.position;
    let value = '';
    while (!this.atEnd()) {
      const character = this.peek();
      if (this.isWhitespace(character) || (inGroup && (character === '|' || character === ')'))) break;
      if (!inGroup && character === ')') break;
      if (character === '"' || character === '(' || character === '|') break;
      if (character === '\\') value += this.parseEscape();
      else {
        value += character;
        this.position++;
      }
    }
    if (!value) {
      throw new SearchParseError(tag ? 'EMPTY_TAG' : 'INVALID_ESCAPE', {
        start,
        end: Math.min(this.input.length, start + 1),
      });
    }
    return value;
  }

  private parseEscape(): string {
    const start = this.position++;
    if (this.atEnd() || !RESERVED.has(this.peek())) {
      if (!this.atEnd()) this.position++;
      throw new SearchParseError('INVALID_ESCAPE', { start, end: this.position });
    }
    return this.input[this.position++]!;
  }

  private isTagPrefix(): boolean {
    return this.input.slice(this.position, this.position + 4).toLocaleLowerCase('und') === 'tag:';
  }
  private skipWhitespace(): void { while (!this.atEnd() && this.isWhitespace(this.peek())) this.position++; }
  private isWhitespace(value: string): boolean { return /\s/u.test(value); }
  private peek(): string { return this.input[this.position] ?? ''; }
  private atEnd(): boolean { return this.position >= this.input.length; }
  private spanHere() { return { start: this.position, end: Math.min(this.input.length, this.position + 1) }; }
}

export function parseSearchQuery(raw: string): SearchAst {
  if (raw.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new SearchParseError('QUERY_TOO_LONG', {
      start: MAX_SEARCH_QUERY_LENGTH,
      end: raw.length,
    });
  }
  return new Parser(raw).parse();
}
