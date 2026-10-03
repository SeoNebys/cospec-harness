# Test strategy

- Domain tests exercise approved state rules using a deterministic page-detail provider.
- Metadata parser tests cover attribute order, entity decoding, and missing required details.
- HTTP integration tests exercise creation, duplicate status, reading status, archive, restore, and single-record identity.
- Browser acceptance uses Chromium against a running application and a controlled HTML page. It exercises readiness, the empty state, invalid input, enrichment, external-card navigation, labels, search, zero results, reversible read status, duplicate prevention, archive/restore, and unavailable page details.
- Visual inspection at a 1440×1000 desktop viewport checks the agreed desktop composition and compact card presentation.
