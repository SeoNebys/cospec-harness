import { Router } from 'express';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
export function tagRouter(repo: BookmarkRepository) {
  return Router().get('/', (_req, res) => res.json({ items: repo.allTags() }));
}
