// Recursive-descent parser → boolean AST.
// Precedence: NOT > AND (incl. implicit adjacency) > OR. Parentheses override.
import { Token, tokenize, SearchSyntaxError } from './tokenizer';

export type Ast =
  | { kind: 'and'; left: Ast; right: Ast }
  | { kind: 'or'; left: Ast; right: Ast }
  | { kind: 'not'; child: Ast }
  | { kind: 'tag'; name: string }
  | { kind: 'phrase'; text: string }
  | { kind: 'term'; text: string }
  | { kind: 'empty' };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): Ast {
    if (this.tokens.length === 0) return { kind: 'empty' };
    const ast = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new SearchSyntaxError('Unexpected token near end of search expression.');
    }
    return ast;
  }

  private parseOr(): Ast {
    let left = this.parseAnd();
    while (this.peek()?.type === 'OR') {
      this.next();
      const right = this.parseAnd();
      left = { kind: 'or', left, right };
    }
    return left;
  }

  private parseAnd(): Ast {
    let left = this.parseNot();
    while (true) {
      const t = this.peek();
      if (!t) break;
      if (t.type === 'AND') {
        this.next();
        const right = this.parseNot();
        left = { kind: 'and', left, right };
      } else if (t.type === 'OR' || t.type === 'RPAREN') {
        break;
      } else {
        // Implicit AND (adjacent atoms).
        const right = this.parseNot();
        left = { kind: 'and', left, right };
      }
    }
    return left;
  }

  private parseNot(): Ast {
    if (this.peek()?.type === 'NOT') {
      this.next();
      return { kind: 'not', child: this.parseNot() };
    }
    return this.parseAtom();
  }

  private parseAtom(): Ast {
    const t = this.next();
    if (!t) throw new SearchSyntaxError('Unexpected end of search expression.');
    switch (t.type) {
      case 'LPAREN': {
        const inner = this.parseOr();
        const close = this.next();
        if (!close || close.type !== 'RPAREN') {
          throw new SearchSyntaxError('Unbalanced parentheses in search expression.');
        }
        return inner;
      }
      case 'TAG':
        return { kind: 'tag', name: t.value };
      case 'PHRASE':
        return { kind: 'phrase', text: t.value };
      case 'TERM':
        return { kind: 'term', text: t.value };
      case 'AND':
      case 'OR':
        throw new SearchSyntaxError(`Search expression cannot start with "${t.value}".`);
      case 'NOT':
        throw new SearchSyntaxError('Dangling NOT in search expression.');
      case 'RPAREN':
        throw new SearchSyntaxError('Unexpected ")" in search expression.');
      default:
        throw new SearchSyntaxError('Malformed search expression.');
    }
  }
}

export function parseSearch(input: string): Ast {
  return new Parser(tokenize(input)).parse();
}

export { SearchSyntaxError };
