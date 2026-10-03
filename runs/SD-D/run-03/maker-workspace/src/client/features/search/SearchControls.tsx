import { type FormEvent, useEffect, useState } from "react";
import { parseSearchQuery } from "../../../shared/search/parser";
import { Button } from "../../components";
import type { TagSummary } from "../../lib/api";
import type { ViewState } from "../../lib/view-state";
import { FilterPanel } from "./FilterPanel";

export interface SearchControlsProps {
  view: ViewState;
  tags: TagSummary[];
  total: number;
  onChange: (next: ViewState) => void;
}

export function SearchControls({ view, tags, total, onChange }: SearchControlsProps) {
  const [query, setQuery] = useState(view.query);
  const [showHelp, setShowHelp] = useState(false);
  const parsed = parseSearchQuery(query);

  useEffect(() => setQuery(view.query), [view.query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed.ok) return;
    onChange({ ...view, query: query.trim(), cursor: null, savedViewId: null });
  }

  function clear() {
    setQuery("");
    onChange({
      ...view,
      query: "",
      tags: [],
      favorite: null,
      unread: null,
      cursor: null,
      savedViewId: null,
    });
  }

  const hasCriteria = Boolean(
    view.query || view.tags.length || view.favorite !== null || view.unread !== null,
  );
  const scopeLabel =
    view.scope === "active" ? "active" : view.scope === "read_later" ? "Read Later" : "archived";
  const availableTagKeys = new Set(
    tags.map((tag) => tag.name.normalize("NFKC").trim().toLocaleLowerCase()),
  );
  const missingTags = view.tags.filter(
    (tag) => !availableTagKeys.has(tag.normalize("NFKC").trim().toLocaleLowerCase()),
  );

  return (
    <search className="search-controls" aria-label="Search and filters">
      <form className="search-form" onSubmit={submit}>
        <label htmlFor="bookmark-search">Search bookmarks</label>
        <div className="search-form__row">
          <input
            id="bookmark-search"
            type="search"
            value={query}
            placeholder={'Try #news, "exact phrase", AND or OR'}
            aria-invalid={!parsed.ok || undefined}
            aria-describedby={!parsed.ok ? "search-syntax-error" : "search-guidance"}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button type="submit" variant="primary" disabled={!parsed.ok}>
            Search
          </Button>
          <Button onClick={() => setShowHelp((current) => !current)} aria-expanded={showHelp}>
            Search syntax help
          </Button>
        </div>
        {!parsed.ok ? (
          <p id="search-syntax-error" className="search-error" role="alert">
            {parsed.error.message} {parsed.error.hint}.
          </p>
        ) : (
          <p id="search-guidance" className="search-guidance">
            Ordinary terms all match. Use #tag, quotes, AND, or OR for precision.
          </p>
        )}
        {showHelp ? (
          <div className="search-help">
            <p>
              Use <code>#news</code> for an exact tag and <code>#&quot;machine learning&quot;</code>{" "}
              for a multiword tag.
            </p>
            <p>
              Put an <strong>exact phrase</strong> in quotes. Adjacent terms act like AND; OR
              accepts either side.
            </p>
          </div>
        ) : null}
      </form>

      <FilterPanel view={view} tags={tags} onChange={onChange} />

      {missingTags.length ? (
        <p className="missing-tag-notice" role="status">
          Missing tag {missingTags.length === 1 ? "filter" : "filters"}: {missingTags.join(", ")}.
          This saved criterion is kept and currently returns no tagged matches.
        </p>
      ) : null}

      <div className="search-summary" aria-live="polite">
        <span>
          {total === 0 && hasCriteria
            ? `No ${scopeLabel} bookmarks match these criteria.`
            : `${total} bookmark${total === 1 ? "" : "s"} in this view.`}
        </span>
        {hasCriteria ? (
          <Button variant="quiet" size="small" onClick={clear}>
            Clear search and filters
          </Button>
        ) : null}
      </div>
    </search>
  );
}
