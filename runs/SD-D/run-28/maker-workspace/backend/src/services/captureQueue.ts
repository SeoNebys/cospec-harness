import type { DB } from '../db/db.ts';
import { applyCapture } from '../models/bookmark.ts';
import { fetchPage, parseMetadata } from './metadata.ts';
import { saveSnapshot } from './snapshot.ts';
import type { CaptureStatus } from '../types.ts';

interface Job {
  id: string;
  url: string;
}

/**
 * In-process FIFO capture queue (research.md §9). Runs metadata + snapshot
 * capture AFTER the save response so the user is never blocked (FR-005). Each
 * bookmark's per-artifact status is written to `capture_status`.
 */
export class CaptureQueue {
  private queue: Job[] = [];
  private active = 0;
  private readonly concurrency: number;
  /** Resolves when the queue drains — used by tests to await capture. */
  private idleResolvers: Array<() => void> = [];

  constructor(
    private db: DB,
    concurrency = 2,
  ) {
    this.concurrency = concurrency;
  }

  enqueue(job: Job): void {
    this.queue.push(job);
    this.pump();
  }

  /** Await until all queued/active jobs finish. */
  onIdle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active++;
      void this.run(job).finally(() => {
        this.active--;
        if (this.active === 0 && this.queue.length === 0) {
          const resolvers = this.idleResolvers;
          this.idleResolvers = [];
          for (const r of resolvers) r();
        } else {
          this.pump();
        }
      });
    }
  }

  private async run(job: Job): Promise<void> {
    const status: CaptureStatus = { metadata: 'pending', snapshot: 'pending' };
    try {
      const page = await fetchPage(job.url);
      let titleCaptured: string | null = null;
      let descriptionCaptured: string | null = null;
      let favicon: string | null = null;
      let previewImage: string | null = null;

      if (page.ok && page.body) {
        const meta = parseMetadata(page.body, job.url);
        titleCaptured = meta.title;
        descriptionCaptured = meta.description;
        favicon = meta.favicon;
        previewImage = meta.previewImage;
        status.metadata = 'ready';
      } else if (page.ok && page.bytes) {
        // PDF or binary: no HTML metadata to parse, but the fetch succeeded.
        status.metadata = 'ready';
      } else {
        status.metadata = 'failed';
      }

      const snap = await saveSnapshot(job.id, page);
      status.snapshot = snap ? 'ready' : 'failed';

      applyCapture(this.db, job.id, {
        titleCaptured,
        descriptionCaptured,
        favicon,
        previewImage,
        snapshotPath: snap?.path ?? null,
        snapshotKind: snap?.kind ?? null,
        captureStatus: status,
      });
    } catch {
      applyCapture(this.db, job.id, {
        captureStatus: { metadata: 'failed', snapshot: 'failed' },
      });
    }
  }
}
