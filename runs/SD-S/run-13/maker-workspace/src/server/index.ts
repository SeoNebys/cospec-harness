import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { createDatabase } from './db/database.js';

const config=getConfig();
const db=createDatabase(config.databasePath);
const app=await buildApp({db,clientPath:config.clientPath,logger:true});
const shutdown=async()=>{ await app.close(); db.close(); process.exit(0); };
process.once('SIGINT',shutdown); process.once('SIGTERM',shutdown);
try { await app.listen({host:config.host,port:config.port}); }
catch(error){ app.log.error(error); db.close(); process.exit(1); }
