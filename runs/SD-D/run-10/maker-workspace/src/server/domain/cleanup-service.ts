import type { AuthRepository } from '../repositories/auth-repository.js';
import type { BulkRepository } from '../repositories/bulk-repository.js';
import type { MediaService } from '../media/media-service.js';

export class CleanupService {
  private timer: NodeJS.Timeout | null = null;
  constructor(
    private readonly auth: AuthRepository,
    private readonly bulk: BulkRepository,
    private readonly media: MediaService,
  ) {}
  async run(): Promise<void> {
    this.auth.cleanupExpired();
    this.bulk.cleanup();
    await this.media.cleanupExpiredDrafts();
    await this.media.cleanupUnreferenced(Date.now() - 24 * 60 * 60_000);
  }
  start(intervalMs = 60 * 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
