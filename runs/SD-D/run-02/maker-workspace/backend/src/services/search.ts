/**
 * Search query builder + runner (FR-013/014/015).
 *
 * Translates a human search expression into an FTS5 MATCH query. Supported:
 *   - bare words       -> AND by default, prefix-matched   (recipe pasta)
 *   - "exact phrase"   -> phrase match                      ("slow cooker")
 *   - OR               -> alternatives                      (recipe OR dinner)
 *   - tag:NAME         -> scoped to tags (also -tag:NAME)   (tag:recipe)
 *   - -TERM / NOT TERM -> exclusion                         (articles -tag:work)
 *   - ( ... )          -> grouping                          ((recipe OR dinner) -work)
 *
 * Exclusions are separated out so that even a query like "(a OR b) -c" and a
 * pure-negative query ("-work") both work against a contentless FTS index.
 */
import type Database from 'better-sqlite3';

export interface ParsedSearch {
  positive: string | null; // FTS5 MATCH expression for included terms
  negative: string | null; // FTS5 MATCH expression for excluded terms
}

const RAW_TOKEN = /"[^"]*"|\(|\)|[^\s()]+/g;

function renderTerm(rawValue: string): string {
  // rawValue may carry a phrase (quoted) or a bare word, possibly tag-scoped.
  let scope = '';
  let value = rawValue;
  const m = /^(tag|tags):(.*)$/i.exec(rawValue);
  if (m) {
    scope = 'tags:';
    value = m[2];
  }
  const isPhrase = value.startsWith('"') && value.endsWith('"');
  const inner = isPhrase ? value.slice(1, -1) : value;
  const escaped = inner.replace(/"/g, '""');

  if (!isPhrase && /^[\p{L}\p{N}]+$/u.test(inner)) {
    // Simple word -> friendly prefix match.
    return `${scope}${escaped}*`;
  }
  return `${scope}"${escaped}"`;
}

export function parseSearch(input: string): ParsedSearch {
  const tokens = (input ?? '').match(RAW_TOKEN) ?? [];
  const positive: string[] = [];
  const negatives: string[] = [];
  let depth = 0;
  let pendingNot = false;

  for (const tok of tokens) {
    if (tok === '(') {
      depth++;
      positive.push('(');
      continue;
    }
    if (tok === ')') {
      depth = Math.max(0, depth - 1);
      positive.push(')');
      continue;
    }
    const upper = tok.toUpperCase();
    if (upper === 'OR' || upper === 'AND') {
      positive.push(upper);
      continue;
    }
    if (upper === 'NOT') {
      if (depth === 0) pendingNot = true;
      continue;
    }

    let negated = false;
    let body = tok;
    if (depth === 0 && (body.startsWith('-') && body.length > 1)) {
      negated = true;
      body = body.slice(1);
    }
    if (pendingNot) {
      negated = true;
      pendingNot = false;
    }

    const rendered = renderTerm(body);
    if (negated) negatives.push(rendered);
    else positive.push(rendered);
  }

  const positiveExpr = positive.join(' ').trim();
  return {
    positive: positiveExpr.length ? positiveExpr : null,
    negative: negatives.length ? `(${negatives.join(' OR ')})` : null,
  };
}

/**
 * Run a search, returning matching bookmark ids in relevance order.
 * `archived` controls whether the search looks in the main collection or the archive (FR-016).
 */
export function searchIds(db: Database.Database, input: string, archived: boolean): number[] {
  const { positive, negative } = parseSearch(input);
  if (!positive && !negative) return [];

  const archivedFlag = archived ? 1 : 0;
  const matchId = (expr: string): number[] =>
    (
      db
        .prepare(
          `SELECT f.rowid AS id FROM bookmarks_fts f
           JOIN bookmarks b ON b.id = f.rowid
           WHERE bookmarks_fts MATCH ? AND b.archived = ?
           ORDER BY rank`
        )
        .all(expr, archivedFlag) as { id: number }[]
    ).map((r) => r.id);

  if (positive) {
    const included = matchId(positive);
    if (!negative) return included;
    const excluded = new Set(matchId(negative));
    return included.filter((id) => !excluded.has(id));
  }

  // Pure-negative query: everything (in scope) minus the excluded matches.
  const excluded = new Set(matchId(negative!));
  const all = db
    .prepare(`SELECT id FROM bookmarks WHERE archived = ? ORDER BY created_at DESC`)
    .all(archivedFlag) as { id: number }[];
  return all.map((r) => r.id).filter((id) => !excluded.has(id));
}
