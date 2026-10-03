# Later-cycle requests

Recorded during cycle 1; not implemented in this cycle. Each becomes (or feeds)
a scenario in a future cycle.

| # | Request | Origin | Notes |
|---|---------|--------|-------|
| L-01 | Preserve a saved copy of the page as it was at save time (and the actual PDF for PDFs) | Cycle 1 goal | Core wishlist item 5 |
| L-02 | Track reading status ("still want to read" vs. dealt with) | Cycle 1 goal | Wishlist item 7 |
| L-03 | Archive links without deleting | Cycle 1 goal | Wishlist item 8 |
| L-04 | Filter and sort as the collection grows | Cycle 1 goal | Wishlist item 10 |
| L-05 | Bulk changes across several matching links at once | Cycle 1 goal | Wishlist item 11 |
| L-06 | Import existing browser bookmarks; export them again | Cycle 1 goal | Wishlist item 12 |
| L-07 | Secondary "Import bookmarks" action shown in the empty state | Cycle 1 edge-case exploration | Ships with L-06 (import). Empty state already *mentions* import in cycle 1; the actionable button lands with the import feature. |
| L-08 | User-configurable default sort and default page size (preferences) | Cycle 1 edge-case exploration | Cycle 1 fixes newest-first / 20-per-page; make them adjustable later. |
| L-09 | (superseded) Preservation retry — now IN cycle 1 scope (SCN-014) | Cycle 1 | Resolved: retry captures the copy when the page becomes available. |
| L-10 | Manual refresh / re-capture of a saved copy on demand | Cycle 1 preservation discussion | Cycle 1 captures once and never silently replaces; an explicit user-triggered re-capture could be added later. |
| L-11 | Full-fidelity backup/restore (notes, read/archive state, saved copies) | Cycle 1 import/export discussion | Cycle 1 export is browser-compatible only; a complete backup format could be added later. |

## Broader Markdown in notes
Client is happy with cycle-1 note formatting (bold, bullets, safe links) but
noted they'd eventually expect other common, safe Markdown to render. Revisit if
richer note formatting is requested.
