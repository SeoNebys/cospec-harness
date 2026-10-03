# Performance Validation Results

**Date**: 2026-09-17  
**Command**: `npm run test:performance`  
**Result**: PASS — 2 files, 2 tests

## Environment

- Linux 5.15.0-187-generic, x86-64 container
- Node.js 24.21.0 and npm 11.19.0
- 4 reported vCPUs, Intel Xeon Gold 6448Y
- 15.61 GiB reported memory
- `better-sqlite3` 13.0.3 with SQLite 3.53.4 and FTS5 enabled
- Isolated file-backed temporary databases using foreign keys, WAL, `synchronous=NORMAL`, and a 5-second busy timeout
- No concurrent application traffic or external network activity

These figures are acceptance evidence for this supplied runtime, not a guarantee for materially different hardware or concurrent workloads.

## Method

The search benchmark seeded 10,000 bookmarks plus representative relational tags. It measured five interleaved samples for each operation. Each sample includes AST compilation, bound SQLite queries, total counting, stable sorting, first-page retrieval, tag hydration, and response mapping. Seed time is excluded. The first measured sample is retained rather than discarded as a warm-up.

The bulk benchmark seeded 10,000 bookmarks and materialized a stable 1,000-bookmark selection before each timed action. Each timed sample includes selection consumption, the complete transactional mutation, exact count calculation, cleanup, and commit. Selection creation is measured separately by the selection workflow and is not part of the action timer. Five samples were recorded for every action; delete samples used five disjoint 1,000-row groups. An out-of-selection row was checked after the run.

Percentiles use the nearest-rank method. With five action samples, p95 is the maximum observed sample. Timings use Node's monotonic `performance.now()` clock.

## Search Results — 10,000 Bookmarks

The overall p95 across 45 measured search/filter/sort samples was **179.75 ms**, below the approved **1,000 ms** target.

| Operation | p50 | p95 | Maximum |
|---|---:|---:|---:|
| Rare trigram substring | 1.76 ms | 3.46 ms | 3.46 ms |
| Common trigram substring | 9.56 ms | 10.08 ms | 10.08 ms |
| Two-character scan fallback | 179.75 ms | 185.38 ms | 185.38 ms |
| Contiguous quoted phrase | 2.48 ms | 2.65 ms | 2.65 ms |
| Five-atom `AND` expression | 49.52 ms | 49.88 ms | 49.88 ms |
| Exact tag plus selected-tag filter | 1.66 ms | 1.97 ms | 1.97 ms |
| Tag + favorite + oldest-created sort | 2.36 ms | 2.53 ms | 2.53 ms |
| Unread + recently-updated sort | 1.25 ms | 1.33 ms | 1.33 ms |
| Title sort | 1.02 ms | 1.19 ms | 1.19 ms |

The two-character fallback was the measured search bottleneck, as expected because SQLite trigram indexing cannot serve atoms shorter than three characters. At 185.38 ms p95 it retains more than 800 ms of margin, so no speculative index or denormalization change was applied.

## Bulk Results — 1,000 Selected Bookmarks

Every supported bulk action finished well below the approved **10,000 ms** target. Permanent deletion was the slowest measured action at **23.58 ms p95**.

| Action | p50 | p95 | Maximum |
|---|---:|---:|---:|
| Add tags | 5.18 ms | 6.76 ms | 6.76 ms |
| Remove tags | 5.00 ms | 7.83 ms | 7.83 ms |
| Favorite | 4.60 ms | 4.72 ms | 4.72 ms |
| Unfavorite | 4.58 ms | 4.71 ms | 4.71 ms |
| Mark unread | 4.70 ms | 7.16 ms | 7.16 ms |
| Mark read | 4.66 ms | 4.75 ms | 4.75 ms |
| Archive | 8.53 ms | 11.22 ms | 11.22 ms |
| Restore | 8.02 ms | 10.75 ms | 10.75 ms |
| Permanently delete | 13.94 ms | 23.58 ms | 23.58 ms |

The benchmark also verified exact selected/processed counts and confirmed that bookmark 1,001—outside the selected 1,000 rows—retained its status and tag membership. No measured bulk path justified tuning.

## Query-Plan Evidence

Representative `EXPLAIN QUERY PLAN` details captured by the automated suite:

```text
Trigram term:
SCAN bookmark_search VIRTUAL TABLE INDEX 0:M4

Active scope ordered by creation:
SEARCH bookmarks USING COVERING INDEX bookmarks_archive_created_idx (archived_at=?)

Exact tag lookup and membership:
SEARCH t USING COVERING INDEX sqlite_autoindex_tags_1 (name_key=?)
SEARCH bt USING COVERING INDEX bookmark_tags_tag_bookmark_idx (tag_id=?)

Selection membership consumption:
SEARCH selection_items USING PRIMARY KEY (selection_id=?)

Bulk bookmark update:
SEARCH bookmarks USING INTEGER PRIMARY KEY (rowid=?)

Bulk tag membership:
SEARCH bookmark_tags USING COVERING INDEX bookmark_tags_tag_bookmark_idx (tag_id=?)
```

These plans demonstrate that the benchmarked long-atom search, scope ordering, relational-tag filtering, snapshot consumption, and bulk mutations use the intended virtual table or indexes. The short-atom path deliberately performs its bounded 10,000-row normalized scan.

## Acceptance Conclusion

- SC-004 search/filter/sort p95 under one second at 10,000 bookmarks: **PASS**
- SC-007 supported bulk action on 1,000 bookmarks under ten seconds with no out-of-selection mutation: **PASS**
- Measured bottlenecks requiring implementation tuning: **none**
