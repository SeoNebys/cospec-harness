import type { BookmarkCreate, BookmarkUpdate } from '@shared/contracts.js';
import { AppError } from '@shared/errors.js';
import { assertScalarLimit } from '@shared/normalize.js';
import type { BookmarkRepository } from './bookmark-repository.js';
export class BookmarkService {
  constructor(private repo: BookmarkRepository) {}
  validate(input: { title?: string | null; description?: string | null; noteMarkdown?: string }) {
    if (input.title) assertScalarLimit(input.title, 300, 'Title');
    if (input.description) assertScalarLimit(input.description, 2000, 'Description');
    if (input.noteMarkdown) assertScalarLimit(input.noteMarkdown, 50000, 'Note');
  }
  create(input: BookmarkCreate, metadata?: any) {
    this.validate(input);
    const duplicate = this.repo.findByUrl(input.url);
    if (duplicate)
      throw new AppError(409, 'DUPLICATE', 'This address is already saved.', {
        bookmark: duplicate
      });
    try {
      return this.repo.create(input, metadata);
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE')
        throw new AppError(409, 'DUPLICATE', 'This address is already saved.', {
          bookmark: this.repo.findByUrl(input.url)
        });
      throw e;
    }
  }
  update(id: string, input: BookmarkUpdate, acceptedIconAssetId?: string | null) {
    this.validate(input);
    try {
      const value = this.repo.update(id, input, acceptedIconAssetId);
      if (!value) throw new AppError(404, 'NOT_FOUND', 'Bookmark not found.');
      return value;
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE')
        throw new AppError(409, 'DUPLICATE', 'That address is already saved.');
      throw e;
    }
  }
}
