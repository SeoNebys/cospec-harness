# Saved-Copy Lifecycle Contract

**Version**: 1

## User-visible status

Every bookmark exposes one of:

| Status | Meaning | Allowed user actions |
|---|---|---|
| `pending` | Initial capture is queued or running and no current copy exists | View progress, cancel by deleting bookmark |
| `available` | A validated immutable copy is readable | Open copy, request recapture, delete bookmark |
| `failed` | Initial capture ended without an available copy | Read reason, retry, edit URL, delete bookmark |

When an available copy is being recaptured, the visible copy remains `available`; a separate replacement-attempt status shows queued/running/failed/awaiting confirmation.

## Attempt phases

```text
queued -> fetching -> rendering -> packaging -> validating -> publishing -> available
```

PDF attempts omit rendering/HTML packaging but still fetch, validate, publish, and verify. Any phase may end in `failed` or `cancelled`.

## Stable failure codes

| Code | Meaning | Automatic retry |
|---|---|---|
| `blocked_destination` | URL, redirect, or resource resolves outside allowed public HTTP(S) policy | No |
| `redirect_limit` | Redirect count or cycle limit exceeded | No |
| `timeout` | Bounded operation exceeded deadline | Yes, up to limit |
| `too_large` | Main resource, asset, page bundle, or PDF exceeded configured size | No |
| `too_many_resources` | Page exceeded request/resource limit | No |
| `unsupported_type` | Final resource is neither supported HTML nor valid PDF | No |
| `invalid_pdf` | PDF is truncated, malformed, encrypted without support, or cannot render | No |
| `fetch_failed` | Transient public network/server failure | Yes, up to limit |
| `render_failed` | Browser could not produce a bounded rendered document | Yes when classified transient |
| `unsafe_output` | Static-copy validation found active or remote behavior | No |
| `storage_quota` | Publishing would exceed configured storage quota | No |
| `cancelled` | Bookmark deletion or explicit supersession cancelled the attempt | No |

Errors expose a safe human-readable detail and retry eligibility; internal stack traces, addresses, and paths are not returned.

## Publication invariants

- Bookmark creation and initial queued attempt commit together.
- The worker writes only to staging until all content, hashes, limits, and safety checks pass.
- `available` is committed atomically with immutable saved-copy records and published blob references.
- A late worker cannot publish after bookmark deletion or for a different URL revision.
- An available copy is never mutated.
- Retry creates a new attempt.
- Recapture retains the old current copy until a candidate validates and the user confirms replacement.
- Failed or cancelled recapture leaves the old copy untouched.
- Archive and read-status changes never alter a copy.
- Permanent deletion confirmation explicitly covers the copy; logical access is removed transactionally before blob garbage collection.

## HTML saved-copy response policy

Saved pages are addressed only by bookmark/copy and manifest asset IDs through a dedicated snapshot route. Production may place that route on a separate hostname; the iframe sandbox remains mandatory in every environment. Successful HTML responses include a CSP equivalent to:

```text
default-src 'none';
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
font-src 'self';
script-src 'none';
connect-src 'none';
frame-src 'none';
object-src 'none';
media-src 'none';
worker-src 'none';
form-action 'none';
base-uri 'none';
sandbox
```

They also include `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, an origin-isolating resource policy, and private immutable caching. The app embeds the response in an iframe with an empty `sandbox` attribute. Snapshot content is never inserted into the application document.

## PDF policy

- The primary blob is byte-identical to the successfully delivered PDF.
- Hash, length, structure, and at least one rendered page are validated before publication.
- Reading uses a pinned network-disabled PDF.js viewer at the snapshot boundary.
- PDF actions, attachments, form submission, embedded JavaScript, and external navigation are disabled.
- Downloading the retained original requires an explicit user action and uses a fixed safe filename/content type.

## Default limits

| Limit | Default |
|---|---:|
| Redirect hops | 5 |
| Per-request DNS/connect timeout | 5 seconds |
| Main response header timeout | 10 seconds |
| HTML capture wall time | 45 seconds |
| Quiet period after DOM readiness | 5 seconds |
| Total requests | 500 |
| Single asset | 15 MiB |
| Stored HTML bundle | 100 MiB |
| PDF | 250 MiB |
| Automatic transient retries | 3 with bounded exponential backoff |

A limit breach cannot produce an `available` partial artifact. Missing nonessential resources may produce an available HTML copy only with manifest warnings and after readability/safety validation.
