import type { BookmarkDatabase } from '../connection.js';
import { randomUUID } from 'node:crypto';

export class BaseRepository {
  constructor(
    protected readonly db: BookmarkDatabase,
    protected readonly now: () => number = Date.now,
    protected readonly uuid: () => string = () => randomUUID(),
  ) {}
}
