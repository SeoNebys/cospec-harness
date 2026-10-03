import { spawn } from 'node:child_process';
import fs from 'node:fs';
const entry=new URL('../dist/server/apps/server/src/main.js',import.meta.url);
if(!fs.existsSync(entry))throw new Error('The prepared application is missing. Run npm run build first.');
const child=spawn(process.execPath,[entry.pathname],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>process.exitCode=signal?1:(code??1));
