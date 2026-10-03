# Performance validation

Validated on 2026-09-25 against a local SQLite database populated with 10,000 bookmarks.

| Check | Result |
|---|---:|
| Search sample size | 10,000 bookmarks |
| Median response time | 7.86 ms |
| 95th percentile | 9.21 ms |
| Slowest measured response | 17.84 ms |

The measured 95th percentile is comfortably within the feature plan's interactive-search target. Run `npx tsx scripts/seed-performance.ts` to reproduce this check.
