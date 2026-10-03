import type { BookmarkInput, BookmarkStatus } from '../../shared/contracts/bookmarks.js';
import { AppError } from '../../shared/contracts/problems.js';
import type { BookmarkRepository } from './bookmark-repository.js';
import { distinctTags } from './tag-normalization.js';

export class BookmarkService {
  constructor(private repository: BookmarkRepository) {}

  private validate(input: BookmarkInput) {
    const tags = distinctTags(input.tags);
    if (tags.length > 20)
      throw new AppError(422, 'VALIDATION_ERROR', 'Use no more than 20 tags.', {
        issues: [{ field: 'tags', message: 'Use no more than 20 distinct tags.' }],
      });
    return { ...input, tags };
  }

  create(userId: string, input: BookmarkInput) {
    const clean = this.validate(input);
    const duplicate = this.repository.findDuplicate(userId, clean.url);
    if (duplicate && !clean.allowDuplicate)
      throw new AppError(409, 'DUPLICATE_BOOKMARK', 'You already saved a similar address.', {
        existingBookmark: duplicate,
      });
    return this.repository.create(userId, clean);
  }

  update(userId: string, id: string, input: BookmarkInput) {
    if (!this.repository.findOwned(userId, id))
      throw new AppError(404, 'NOT_FOUND', 'That bookmark was not found.');
    const clean = this.validate(input);
    const duplicate = this.repository.findDuplicate(userId, clean.url, id);
    if (duplicate && !clean.allowDuplicate)
      throw new AppError(409, 'DUPLICATE_BOOKMARK', 'You already saved a similar address.', {
        existingBookmark: duplicate,
      });
    return this.repository.update(userId, id, clean)!;
  }

  favorite(userId: string, id: string, value: boolean) {
    const found = this.repository.setFavorite(userId, id, value);
    if (!found) throw new AppError(404, 'NOT_FOUND', 'That bookmark was not found.');
    return found;
  }
  status(userId: string, id: string, value: BookmarkStatus) {
    const found = this.repository.setStatus(userId, id, value);
    if (!found) throw new AppError(404, 'NOT_FOUND', 'That bookmark was not found.');
    return found;
  }
  delete(userId: string, id: string) {
    if (!this.repository.delete(userId, id))
      throw new AppError(404, 'NOT_FOUND', 'That bookmark was not found.');
  }
}
