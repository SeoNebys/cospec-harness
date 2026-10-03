// Translate a user search string into FTS5 MATCH expressions.
//
// Supported syntax:
//   "exact phrase"        -> matched as an exact phrase
//   foo bar               -> implicit AND
//   foo AND bar           -> both required
//   foo OR bar            -> either
//   foo NOT bar / -bar    -> exclude bar (global exclusion)
//
// Returns { positive, negative } FTS5 expressions (either may be '').
// The caller matches on `positive` (or all rows when empty) and subtracts
// rows matching `negative`.

function tokenize(input) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    if (m[1] !== undefined) {
      tokens.push({ type: 'phrase', value: m[1] });
    } else {
      const w = m[2];
      const upper = w.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
        tokens.push({ type: 'op', value: upper });
      } else {
        tokens.push({ type: 'word', value: w });
      }
    }
  }
  return tokens;
}

// Escape a term/phrase for FTS5: wrap in double quotes so punctuation, URLs
// and reserved words are treated literally as a phrase.
function ftsQuote(value) {
  const cleaned = value.replace(/"/g, ' ').trim();
  return cleaned ? `"${cleaned}"` : '';
}

export function parseQuery(input) {
  if (!input || !input.trim()) return { positive: '', negative: '' };
  const tokens = tokenize(input);
  const positives = []; // { connector, term }
  const negatives = [];
  let connector = 'AND';
  let negateNext = false;

  for (const tok of tokens) {
    if (tok.type === 'op') {
      if (tok.value === 'NOT') negateNext = true;
      else connector = tok.value;
      continue;
    }
    let value = tok.value;
    let negate = negateNext;
    negateNext = false;
    if (tok.type === 'word' && value.startsWith('-') && value.length > 1) {
      negate = true;
      value = value.slice(1);
    }
    const term = ftsQuote(value);
    if (!term) continue;
    if (negate) {
      negatives.push(term);
    } else {
      positives.push({ connector: positives.length ? connector : null, term });
    }
    connector = 'AND';
  }

  const positive = positives
    .map((p, i) => (i === 0 ? p.term : `${p.connector} ${p.term}`))
    .join(' ');
  const negative = negatives.join(' OR ');
  return { positive, negative };
}
