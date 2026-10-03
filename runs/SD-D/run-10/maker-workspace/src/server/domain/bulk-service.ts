import { createHash, randomBytes } from 'node:crypto';
import type { BulkAction, BulkSelection } from '../../shared/contracts/bulk.js';
import { AppError } from '../api/errors.js';
import { hashOpaqueToken } from '../auth/auth-service.js';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import type { BulkRepository } from '../repositories/bulk-repository.js';
import type { SearchRepository } from '../repositories/search-repository.js';
import type { TagRepository } from '../repositories/tag-repository.js';

export class BulkService {
  constructor(
    private readonly repository: BulkRepository,
    private readonly bookmarks: BookmarkRepository,
    private readonly search: SearchRepository,
    private readonly tags: TagRepository,
  ) {}
  preview(userId: number, selection: BulkSelection, action: BulkAction) {
    const items = this.resolve(userId, selection);
    const eligibility = this.eligibility(userId, items, action);
    const required = ['archive', 'restore', 'delete_permanently'].includes(action.type);
    let confirmation: { required: boolean; token?: string; expiresAt?: string; expectedCount?: number } = {
      required,
    };
    if (required) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + 5 * 60_000;
      this.repository.createConfirmation(
        userId,
        hashOpaqueToken(token),
        this.confirmationAction(action),
        JSON.stringify(selection),
        this.digest(selection, action),
        items.length,
        expiresAt,
      );
      confirmation = {
        required: true,
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        expectedCount: items.length,
      };
    }
    return {
      selectionCount: items.length,
      eligibleCount: eligibility.eligible.length,
      ineligibleCount: eligibility.ineligible.length,
      ineligible: eligibility.ineligible,
      confirmation,
    };
  }
  execute(userId: number, selection: BulkSelection, action: BulkAction, token?: string) {
    const items = this.resolve(userId, selection);
    const required = ['archive', 'restore', 'delete_permanently'].includes(action.type);
    if (required) {
      if (!token) throw new AppError(422, 'confirmation_required', 'Preview and confirm this action first.');
      const row = this.repository.getConfirmation(userId, hashOpaqueToken(token));
      if (
        !row ||
        row.criteriaDigest !== this.digest(selection, action) ||
        row.action !== this.confirmationAction(action)
      )
        throw new AppError(422, 'invalid_confirmation', 'This confirmation is invalid or expired.');
      if (!this.repository.consume(row.id))
        throw new AppError(422, 'invalid_confirmation', 'This confirmation was already used.');
      if (row.expectedCount !== items.length)
        throw new AppError(
          409,
          'selection_changed',
          'The matching selection changed. Review and confirm the new count.',
          { expectedCount: row.expectedCount, currentCount: items.length },
        );
    }
    const tagIds =
      action.type === 'tags.add' || action.type === 'tags.remove'
        ? action.tagIds.map((id) => {
            const tag = this.tags.getOwned(userId, id);
            if (!tag) throw new AppError(404, 'tag_not_found', 'Tag was not found.');
            return tag.id;
          })
        : [];
    const result = this.repository.apply(userId, items, action, tagIds);
    return {
      selectedCount: items.length,
      succeededCount: result.succeeded,
      failedCount: result.failures.length,
      failures: result.failures,
    };
  }
  private resolve(userId: number, selection: BulkSelection) {
    if (selection.mode === 'query') return this.search.allMatchingIds(userId, selection.criteria);
    return selection.items.map((i) => ({ id: i.id, version: i.expectedVersion }));
  }
  private eligibility(userId: number, items: Array<{ id: string; version: number }>, action: BulkAction) {
    const ineligible: Array<{ id: string; reason: string }> = [];
    const eligible = [] as typeof items;
    const records = new Map(
      this.bookmarks
        .getOwnedMany(
          userId,
          items.map((item) => item.id),
        )
        .map((row) => [row.id, row]),
    );
    for (const item of items) {
      const bookmark = records.get(item.id);
      if (!bookmark) {
        ineligible.push({ id: item.id, reason: 'not_found' });
        continue;
      }
      if (bookmark.version !== item.version) {
        ineligible.push({ id: item.id, reason: 'stale_version' });
        continue;
      }
      if (action.type === 'archive' && bookmark.archivedAt) {
        ineligible.push({ id: item.id, reason: 'already_archived' });
        continue;
      }
      if (action.type === 'restore' && !bookmark.archivedAt) {
        ineligible.push({ id: item.id, reason: 'already_active' });
        continue;
      }
      eligible.push(item);
    }
    return { eligible, ineligible };
  }
  private digest(selection: BulkSelection, action: BulkAction) {
    return createHash('sha256').update(JSON.stringify({ selection, action })).digest('hex');
  }
  private confirmationAction(action: BulkAction) {
    return action.type === 'delete_permanently' ? 'delete' : action.type;
  }
}
