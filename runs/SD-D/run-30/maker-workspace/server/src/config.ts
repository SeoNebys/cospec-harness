import path from 'node:path';

export interface Config { host:string; port:number; dataDir:string; databasePath:string; metadataTimeoutMs:number; maxHtmlBytes:number; maxImageBytes:number }
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir=path.resolve(env.BOOKMARK_DATA_DIR || '.data');
  const port=Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT must be a valid TCP port');
  return { host:env.HOST||'0.0.0.0', port, dataDir, databasePath:env.DATABASE_PATH||path.join(dataDir,'bookmarks.sqlite'), metadataTimeoutMs:Number(env.METADATA_TIMEOUT_MS||8000), maxHtmlBytes:2*1024*1024, maxImageBytes:2*1024*1024 };
}
