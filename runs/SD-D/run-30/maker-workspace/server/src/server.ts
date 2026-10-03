import fs from 'node:fs';
import { loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { createApp } from './app.js';
const config=loadConfig();fs.mkdirSync(config.dataDir,{recursive:true});const db=openDatabase(config.databasePath);const server=createApp(db,config).listen(config.port,config.host,()=>console.log(`Keepmark listening on http://${config.host}:${config.port}`));
function shutdown(){server.close(()=>{db.close();process.exit(0)})}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
