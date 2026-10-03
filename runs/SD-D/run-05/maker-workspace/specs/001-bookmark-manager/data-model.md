# Data Model: Bookmark Manager

## Bookmark

UUID `id`; `display_url`; unique `normalized_url`; `title` (1–300); nullable `description` (≤2,000); nullable local `icon_path`; `note_markdown` (≤50,000); derived `note_plain`; `is_read`; nullable `archived_at`; `created_at`; `updated_at`.

Only HTTP(S) is valid. New/imported records are unread. Archive retains read state. Active → archived → active is reversible; either state → deleted is permanent after confirmation.

## Tag and BookmarkTag

Tag: UUID, `display_name` (1–100), unique case-folded `normalized_name`, timestamps. BookmarkTag is unique `(bookmark_id, tag_id)`. A bookmark has at most 100 tags. Unreferenced tags may be removed after mutations.

## BookmarkSearch Projection

FTS5 rows keyed by bookmark ID contain title, displayed URL, description, visible note text, and tag text. Updates occur in the same transaction as source changes. Exact `tag:` uses relational data.

## SavedSearch

UUID; `name` (1–100); unique case-folded `normalized_name`; `query_text`; versioned `criteria_json`; `parser_version`; `scope` (`active|archived|all`); `read_filter` (`all|read|unread`); `sort_key`; timestamps. No result IDs or page number are stored.

## Preferences

Singleton with `default_sort` (`newest|oldest|title_asc|title_desc|updated`), `page_size` (`10|25|50|100`), `text_size` (`small|standard|large`), and `updated_at`. Defaults: newest, 25, standard.

## BulkOperation and Targets

Operation: opaque UUID token, action, validated parameters, criteria hash, mode (`explicit|all_matches`), expected count, created/expiry/consumed timestamps. Targets are unique `(operation_token, bookmark_id)` rows.

Transitions: previewed → executed, stale, or expired. Execution re-evaluates eligibility and exact set equality in one transaction. Tokens are single-use.

## ImportRun and ImportIssue

Run: UUID, safe filename, status (`staged|completed|rejected`), added/duplicate/failed counts, timestamps. Issues hold entry position, optional title/address, stable reason code, and safe message. Unsupported files add nothing; partially valid files commit valid unique entries and issues together.

## Integrity and Indexes

- Unique normalized URL, tag name, saved-search name, and bookmark/tag pair.
- Reverse `(tag_id, bookmark_id)` index.
- Partial/deterministic indexes for archive/read and all sorts, with ID tie-breakers.
- Foreign keys cascade association, search, and operation-target cleanup.
- Check constraints enforce enums/preferences; services enforce sizes and counts.
