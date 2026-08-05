// A simple serialized background work queue. Jobs (fetching page metadata,
// capturing saved copies, per-item import work) run one at a time off the UI's
// critical path, so saving a bookmark returns immediately and the window never
// freezes (FR-006, Decision 8).
export type Job = () => Promise<void>

export class WorkQueue {
  private jobs: Job[] = []
  private running = false

  enqueue(job: Job): void {
    this.jobs.push(job)
    void this.drain()
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!
        try {
          await job()
        } catch (err) {
          // A failed background job (e.g. an unreachable page) must never crash
          // the app; it degrades gracefully and the next job proceeds.
          console.error('[queue] background job failed:', err)
        }
      }
    } finally {
      this.running = false
    }
  }

  // Test helper: resolves once the queue has drained.
  async onIdle(): Promise<void> {
    while (this.running || this.jobs.length > 0) {
      await new Promise((r) => setTimeout(r, 5))
    }
  }
}
