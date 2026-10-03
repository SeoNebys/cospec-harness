import type { BookmarkRepository } from './bookmark-repository.js';
export class BookmarkStateService {
  constructor(private repo: BookmarkRepository) {}
  setRead(id: string, value: boolean) {
    return this.repo.update(id, { isRead: value });
  }
  archive(id: string) {
    return this.repo.update(id, { archived: true });
  }
  restore(id: string) {
    return this.repo.update(id, { archived: false });
  }
}
