import type Database from 'better-sqlite3';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
import type { MetadataService } from './metadata-service.js';
type Job = { id: string; bookmark_id: string; attempt_count: number };
export class EnrichmentWorker {
  private timer: NodeJS.Timeout | null = null;
  private active = 0;
  private hosts = new Set<string>();
  constructor(
    private db: Database.Database,
    private bookmarks: BookmarkRepository,
    private metadata: MetadataService
  ) {}
  start() {
    this.db
      .prepare(
        "UPDATE metadata_jobs SET status='queued',started_at=NULL WHERE status='running' AND attempt_count=0"
      )
      .run();
    this.timer = setInterval(() => void this.tick(), 750);
    this.timer.unref();
    void this.tick();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  private async tick() {
    if (this.active >= 4) return;
    const jobs = this.db
      .prepare(
        "SELECT id,bookmark_id,attempt_count FROM metadata_jobs WHERE status='queued' ORDER BY created_at LIMIT 12"
      )
      .all() as Job[];
    for (const job of jobs) {
      if (this.active >= 4) break;
      const bookmark = this.bookmarks.get(job.bookmark_id);
      if (!bookmark) {
        this.db.prepare('DELETE FROM metadata_jobs WHERE id=?').run(job.id);
        continue;
      }
      const host = new URL(bookmark.url).hostname;
      if (this.hosts.has(host)) continue;
      const claimed = this.db
        .prepare(
          "UPDATE metadata_jobs SET status='running',attempt_count=1,started_at=? WHERE id=? AND status='queued'"
        )
        .run(new Date().toISOString(), job.id).changes;
      if (!claimed) continue;
      this.active++;
      this.hosts.add(host);
      void this.run(job.id, bookmark.id, bookmark.url, host);
    }
  }
  private async run(jobId: string, bookmarkId: string, url: string, host: string) {
    let status = 'failed',
      code: string | null = 'unavailable';
    try {
      const result = await this.metadata.preview(url);
      const proposal = this.metadata.consume(result.proposalToken, url);
      if (proposal) {
        this.bookmarks.applyMissingMetadata(bookmarkId, proposal);
        status = result.status === 'complete' ? 'complete' : 'partial';
        code = null;
      } else if (result.status === 'blocked') {
        status = 'blocked';
        code = 'blocked';
      }
    } catch {
    } finally {
      this.db
        .prepare('UPDATE metadata_jobs SET status=?,last_error_code=?,finished_at=? WHERE id=?')
        .run(status, code, new Date().toISOString(), jobId);
      this.active--;
      this.hosts.delete(host);
    }
  }
}
