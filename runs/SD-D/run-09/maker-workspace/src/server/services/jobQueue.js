// Lightweight in-process background queue: sequential worker, per-job error
// isolation. Used only for snapshot capture (research Decision 11).

const queue = [];
let running = false;
const handlers = new Map();

// Register a handler for a job type.
export function registerHandler(type, fn) {
  handlers.set(type, fn);
}

export function enqueue(type, payload) {
  queue.push({ type, payload });
  process.nextTick(drain);
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      const fn = handlers.get(job.type);
      if (!fn) continue;
      try {
        await fn(job.payload);
      } catch (err) {
        // Per-job isolation: log and continue.
        // eslint-disable-next-line no-console
        console.error(`[jobQueue] job "${job.type}" failed:`, err.message);
      }
    }
  } finally {
    running = false;
  }
}

// Test/util helper: resolve when the queue has drained.
export async function waitForIdle() {
  while (running || queue.length) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 10));
  }
}

export function _resetForTests() {
  queue.length = 0;
  running = false;
  handlers.clear();
}
