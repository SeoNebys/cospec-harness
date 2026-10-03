import type { SavedView, SavedViewWrite, SearchCriteria } from "../../../shared/contracts/api.js";
import { parseSearchQueryOrThrow } from "../../../shared/search/parser.js";
import { normalizeExactTag } from "../../../shared/search/tokenizer.js";
import { SEARCH_GRAMMAR_VERSION } from "../../../shared/search/types.js";
import {
  normalizeSavedViewName,
  type SavedViewMutation,
  type SavedViewRepository,
} from "../../repositories/saved-view-repository.js";

function normalizedTags(tags: readonly string[]): SavedViewMutation["tags"] {
  const byKey = new Map<string, { displayName: string; tagKey: string }>();
  for (const value of tags) {
    const displayName = value.replace(/\s+/gu, " ").trim();
    const tagKey = normalizeExactTag(displayName);
    if (tagKey !== "" && !byKey.has(tagKey)) byKey.set(tagKey, { displayName, tagKey });
  }
  return [...byKey.values()].sort((left, right) =>
    left.tagKey < right.tagKey ? -1 : left.tagKey > right.tagKey ? 1 : 0,
  );
}

export function toSearchCriteria(view: SavedView): SearchCriteria {
  if (view.grammarVersion !== SEARCH_GRAMMAR_VERSION) {
    throw new Error(`Unsupported saved-view grammar version: ${view.grammarVersion}`);
  }
  parseSearchQueryOrThrow(view.query);
  return {
    scope: view.scope,
    query: view.query,
    tags: [...view.tags],
    favorite: view.favorite ?? null,
    unread: view.unread ?? null,
    sort: view.sort,
  };
}

export class SavedViewService {
  constructor(
    private readonly savedViews: SavedViewRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): SavedView[] {
    return this.savedViews.list();
  }

  get(id: number): SavedView {
    return this.savedViews.get(id);
  }

  create(input: SavedViewWrite): SavedView {
    return this.savedViews.create(this.values(input));
  }

  update(id: number, input: SavedViewWrite): SavedView {
    return this.savedViews.update(id, this.values(input));
  }

  delete(id: number): void {
    this.savedViews.delete(id);
  }

  criteriaFor(id: number): SearchCriteria {
    return toSearchCriteria(this.get(id));
  }

  private values(input: SavedViewWrite): SavedViewMutation {
    parseSearchQueryOrThrow(input.query);
    return {
      name: normalizeSavedViewName(input.name),
      query: input.query,
      tags: normalizedTags(input.tags),
      scope: input.scope,
      favorite: input.favorite ?? null,
      unread: input.unread ?? null,
      sort: input.sort,
      now: this.now().toISOString(),
    };
  }
}
