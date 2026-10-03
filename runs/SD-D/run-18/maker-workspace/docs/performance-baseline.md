# Performance baseline

Measured on the provided development container with Node.js 24 and SQLite WAL. Automated thresholds enforce discovery among 10,000 bookmarks in under 1 second and a 500-item bulk read-state mutation in under 5 seconds. Import/export remain streaming at the HTTP boundary and collection pagination is capped at 100 records per response.
