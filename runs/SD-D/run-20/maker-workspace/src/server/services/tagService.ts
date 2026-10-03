import type { TagRepository } from '../repositories/tagRepository.js';
export class TagService {
  constructor(private repository: TagRepository) {}
  suggest(input: string, excludeBookmarkId?: string) {
    return this.repository
      .suggest(input, excludeBookmarkId)
      .map((tag) => ({ id: tag.public_id, label: tag.label }));
  }
}
