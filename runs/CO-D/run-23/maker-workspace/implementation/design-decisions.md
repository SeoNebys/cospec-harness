# Design decisions

- **Local, single-user service.** One Node process serves the browser UI and a JSON API. There is no account or sharing model because Cycle 1 is explicitly personal.
- **Durable, portable storage.** Application state is atomically written to `implementation/data/store.json`. Page captures and PDFs live inside the same model so the full JSON backup is genuinely self-contained and restorable.
- **Immutable captures.** A capture is created on save or explicit retry and is never refreshed implicitly. Editing an address changes only the address and displayed source.
- **Conservative address identity.** Scheme/host casing, fragments, trailing slashes, and known tracking parameters are ignored for duplicate detection. Other query parameters are retained.
- **Safe remote retrieval.** Only HTTP(S) addresses are accepted; loopback, link-local, and private network targets are rejected before fetch. Retrieval has time and size limits.
- **Browser-readable imports.** Netscape bookmark HTML is parsed in the browser/service boundary, previewed, then committed from an opaque preview token. Existing bookmark text is never overwritten; folder labels are merged.
- **Search composition.** Free text/exact phrase/site exclusion are AND conditions. Selected labels can be matched as any or all. Put-away items are excluded unless that view is active.
- **No prototype dependency.** Production files in `implementation/` were written independently from the approved scenario specifications and do not import or reuse Phase 1 prototype assets.
