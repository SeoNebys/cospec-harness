# Facilitation session log

## SESSION-020 preparation

- Persistence across closing and reopening the browser depends on passage of time and durable application storage rather than a distinct screen state. Per the edge-case guidance, this behavior will be confirmed directly with the client instead of simulated by the static prototype.

## SESSION-020 result

- The client confirmed that bookmarks, edited details, tags, Read later state, Archive state, saved views, and saved page copies must all persist across browser closure, computer restart, and later visits.

## SESSION-021 preparation

- The relationship between a captured page copy and later changes to the external original depends on passage of time and an external website change. Per the edge-case guidance, this behavior will be confirmed directly instead of simulated by the static prototype.

## SESSION-021 result

- The client confirmed that the saved copy stays frozen at the captured version and that opening the current original page must not alter the snapshot.
