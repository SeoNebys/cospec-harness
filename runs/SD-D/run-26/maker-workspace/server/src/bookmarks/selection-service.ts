import { AppError } from '@shared/errors.js';
import type { BulkRequestSchema } from '@shared/contracts.js';
import type { z } from 'zod';
import type { BookmarkRepository } from './bookmark-repository.js';
type Selection = z.infer<typeof BulkRequestSchema>['selection'];
export class SelectionService {
  constructor(private repo: BookmarkRepository) {}
  resolve(selection: Selection) {
    if ('ids' in selection) return [...new Set(selection.ids)];
    const first = this.repo.list({
      collection: selection.collection,
      query: selection.query,
      tag: selection.tag,
      sort: selection.sort,
      limit: 1000
    });
    if (first.queryFingerprint !== selection.queryFingerprint)
      throw new AppError(
        409,
        'BAD_REQUEST',
        'The matching results changed. Review the selection and try again.'
      );
    const ids = first.items.map((x) => x.id);
    for (let offset = ids.length; offset < first.total; offset += 1000)
      ids.push(
        ...this.repo
          .list({
            collection: selection.collection,
            query: selection.query,
            tag: selection.tag,
            sort: selection.sort,
            limit: 1000,
            offset
          })
          .items.map((x) => x.id)
      );
    const excluded = new Set(selection.excludeIds);
    return ids.filter((id) => !excluded.has(id));
  }
}
