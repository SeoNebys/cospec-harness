// Parse a search query into SQL conditions.
//
// Supported syntax:
//   plain terms        -> AND match across title/description/notes/url/domain
//   "exact phrase"     -> substring match on the whole phrase
//   -term  -"phrase"   -> exclusion (negated match)
//   tag:name  -tag:x   -> has / does not have tag (quote for spaces: tag:"my tag")
//   site:example.com   -> domain contains
//   is:read-later | is:archived | is:active | is:snapshot   (also negatable)

const SORTS = {
  created_desc: 'b.created_at DESC',
  created_asc: 'b.created_at ASC',
  updated_desc: 'b.updated_at DESC',
  updated_asc: 'b.updated_at ASC',
  title_asc: 'b.title COLLATE NOCASE ASC, b.url ASC',
  title_desc: 'b.title COLLATE NOCASE DESC, b.url DESC',
  domain_asc: 'b.domain COLLATE NOCASE ASC, b.created_at DESC',
};

export function sortClause(sort) {
  return SORTS[sort] || SORTS.created_desc;
}

// Split a query string into tokens, honouring double quotes.
function tokenize(query) {
  const tokens = [];
  const re = /(-?)(?:([a-z]+):)?(?:"([^"]*)"|(\S+))/gi;
  let m;
  while ((m = re.exec(query)) !== null) {
    const negate = m[1] === '-';
    const field = m[2] ? m[2].toLowerCase() : null;
    const value = m[3] !== undefined ? m[3] : m[4];
    if (value === undefined || value === '') continue;
    tokens.push({ negate, field, value });
  }
  return tokens;
}

const TEXT_MATCH =
  "(b.title LIKE ? OR b.description LIKE ? OR b.notes LIKE ? OR b.url LIKE ? OR b.domain LIKE ?)";

function textParams(value) {
  const like = `%${value}%`;
  return [like, like, like, like, like];
}

// Returns { where: string, params: any[] } to append after a base WHERE.
export function buildSearch(query) {
  const clauses = [];
  const params = [];

  for (const { negate, field, value } of tokenize(query || '')) {
    if (field === 'tag') {
      const sub =
        'EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id ' +
        'WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)';
      clauses.push(negate ? `NOT ${sub}` : sub);
      params.push(value);
    } else if (field === 'site') {
      clauses.push(negate ? 'b.domain NOT LIKE ?' : 'b.domain LIKE ?');
      params.push(`%${value}%`);
    } else if (field === 'is') {
      const flag = value.toLowerCase();
      let cond = null;
      if (flag === 'read-later' || flag === 'readlater') cond = 'b.read_later = 1';
      else if (flag === 'archived') cond = 'b.archived = 1';
      else if (flag === 'active') cond = 'b.archived = 0';
      else if (flag === 'snapshot') cond = 'EXISTS (SELECT 1 FROM snapshots s WHERE s.bookmark_id = b.id)';
      if (cond) clauses.push(negate ? `NOT (${cond})` : cond);
    } else {
      // Plain term or quoted phrase -> text match across fields.
      clauses.push(negate ? `NOT ${TEXT_MATCH}` : TEXT_MATCH);
      params.push(...textParams(value));
    }
  }

  return { where: clauses.join(' AND '), params };
}

// Base condition for a listing scope.
export function scopeClause(scope) {
  switch (scope) {
    case 'archived':
      return 'b.archived = 1';
    case 'read-later':
      return 'b.read_later = 1 AND b.archived = 0';
    case 'all':
      return '1 = 1';
    case 'active':
    default:
      return 'b.archived = 0';
  }
}
