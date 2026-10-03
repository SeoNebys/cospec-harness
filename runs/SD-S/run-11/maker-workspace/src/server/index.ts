import { getConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { migrate } from './db/migrate.ts';
import { createApp } from './app.ts';
import { log } from './logging.ts';

const config=getConfig();const db=openDatabase(config.databasePath);migrate(db);const app=await createApp(db,config.production);
const server=app.listen(config.port,config.host,()=>log('server_started',{host:config.host,port:config.port}));
function shutdown(signal:string){log('server_stopping',{signal});server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),5000).unref();}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
