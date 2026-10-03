import { normalizeExactTag } from "../../../shared/search/tokenizer.js";
import type { SearchAst, SearchExpression } from "../../../shared/search/types.js";

export interface CompiledSearch {
  /** A complete parameterized ID-set query, or all bookmark IDs for Empty. */
  readonly sql: string;
  readonly parameters: readonly string[];
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und");
}

function scalarLength(value: string): number {
  return [...value].length;
}

/** Encode user text as one FTS5 string literal, never as FTS syntax. */
function ftsPhrase(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

class AstCompiler {
  private readonly commonTableExpressions: string[] = [];
  private readonly bound: string[] = [];
  private sequence = 0;

  compile(ast: SearchAst): CompiledSearch {
    if (ast.kind === "Empty") {
      return Object.freeze({
        sql: "SELECT id FROM bookmarks",
        parameters: Object.freeze([]),
      });
    }

    const root = this.expression(ast);
    return Object.freeze({
      sql: `WITH ${this.commonTableExpressions.join(", ")} SELECT id FROM ${root}`,
      parameters: Object.freeze([...this.bound]),
    });
  }

  private expression(node: SearchExpression): string {
    if (node.kind === "And" || node.kind === "Or") {
      const left = this.expression(node.left);
      const right = this.expression(node.right);
      const name = this.nextName();
      const operator = node.kind === "And" ? "INTERSECT" : "UNION";
      this.commonTableExpressions.push(
        `${name}(id) AS (SELECT id FROM ${left} ${operator} SELECT id FROM ${right})`,
      );
      return name;
    }

    const name = this.nextName();
    if (node.kind === "Tag") {
      this.bound.push(node.normalizedValue);
      this.commonTableExpressions.push(
        `${name}(id) AS (` +
          "SELECT bt.bookmark_id FROM bookmark_tags bt " +
          "JOIN tags t ON t.id = bt.tag_id WHERE t.name_key = ?" +
          ")",
      );
      return name;
    }

    const normalized = normalizeSearchText(node.value);
    if (scalarLength(normalized) < 3) {
      this.bound.push(normalized, normalized, normalized, normalized, normalized);
      this.commonTableExpressions.push(
        `${name}(id) AS (` +
          "SELECT b.id FROM bookmarks b WHERE " +
          "instr(search_normalize(b.title), ?) > 0 OR " +
          "instr(search_normalize(b.address), ?) > 0 OR " +
          "instr(search_normalize(b.description), ?) > 0 OR " +
          "instr(search_normalize(b.note_plain), ?) > 0 " +
          "UNION SELECT bt.bookmark_id FROM bookmark_tags bt " +
          "JOIN tags t ON t.id = bt.tag_id WHERE instr(t.name_key, ?) > 0" +
          ")",
      );
      return name;
    }

    this.bound.push(ftsPhrase(normalized), normalized);
    this.commonTableExpressions.push(
      `${name}(id) AS (` +
        "SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ? " +
        "UNION SELECT bt.bookmark_id FROM bookmark_tags bt " +
        "JOIN tags t ON t.id = bt.tag_id WHERE instr(t.name_key, ?) > 0" +
        ")",
    );
    return name;
  }

  private nextName(): string {
    const name = `search_set_${this.sequence}`;
    this.sequence += 1;
    return name;
  }
}

/** Compile only trusted SQL structure; every AST value is returned separately. */
export function compileSearchAst(ast: SearchAst): CompiledSearch {
  return new AstCompiler().compile(ast);
}

export function normalizeTagFilter(value: string): string {
  return normalizeExactTag(value);
}
