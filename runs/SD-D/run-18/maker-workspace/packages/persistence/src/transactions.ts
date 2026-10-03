import type { DB } from './database.js';
export const transaction=<T>(db:DB,fn:()=>T)=>db.transaction(fn)();
