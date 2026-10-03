import { loadConfig } from './bootstrap/config.js';
import { openDatabase } from '../../../packages/persistence/src/database.js';
import { migrate } from '../../../packages/persistence/src/migrate.js';
import { startWorker } from '../../worker/src/jobs/runner.js';
import { createApp } from './app.js';
import { Store } from '../../../packages/persistence/src/store.js';
import { recoverWorkerState } from '../../worker/src/jobs/recovery.js';
const config=loadConfig(),db=openDatabase(config.dbPath);migrate(db);recoverWorkerState(db,config.tmpDir);new Store(db).cleanupBlobs();const worker=startWorker(db,config);const app=await createApp(db,config,worker);const shutdown=async()=>{worker.stop();await app.close();db.close();process.exit(0)};process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());await app.listen({host:config.host,port:config.port});
