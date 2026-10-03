# Design decisions

- The first cycle is a single-user web application with server-backed JSON persistence. This keeps the approved cross-browser behavior without introducing unapproved account or sharing flows.
- Production code is implemented independently under `implementation/`; no prototype source is imported or reused.
- The server owns bookmark state and exact-address duplicate detection. URL parsing normalizes safe mechanical details such as host case and default ports, while referral parameters and section fragments remain distinct in this cycle, matching the deferred conservative-normalization decision.
- Metadata collection supports public HTTP(S) pages, follows redirects, limits response time and size, and blocks private-network destinations. Failure creates an editable domain/URL fallback instead of rejecting a valid link.
- Search, view filtering, tag filtering, and sorting are performed from persisted bookmark fields on the server-facing model. The first-cycle scale does not require a search index.
- Archive and Read later are states on the original bookmark, never copies. Restore and Mark as read change only those states.
- Permanent deletion is exposed only through named confirmation dialogs. Archive is immediate because it is reversible.
- Bulk actions operate on explicit selected IDs and report the affected count.

## Deferred by client request

- Rich note formatting.
- Tag-specific and richer multi-word search semantics.
- Conservative same-page recognition beyond exact normalized addresses.
