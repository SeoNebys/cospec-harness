import { createApp } from './app.js';
import { getDb } from './db/connection.js';
import { registerHandler } from './services/jobQueue.js';
import { runSnapshotJob, recoverPendingSnapshots } from './services/snapshot.js';

const PORT = Number(process.env.PORT || 4000);
const HOST = '0.0.0.0';

// Initialize DB (runs migrations).
getDb();

// Register the background snapshot handler and recover interrupted captures.
registerHandler('snapshot', (payload) => runSnapshotJob(payload));

const recovered = recoverPendingSnapshots();
if (recovered) {
  // eslint-disable-next-line no-console
  console.log(`[startup] re-enqueued ${recovered} pending snapshot(s)`);
}

const app = createApp();
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Bookmark Manager listening on http://${HOST}:${PORT}`);
});
