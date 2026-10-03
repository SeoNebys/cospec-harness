import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.js';

test('persists bookmark data and sort preference across reloads', async t => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'keepmark-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const file=path.join(directory,'data.json');
  const first=new Store(file);await first.load();await first.mutate(data=>{data.bookmarks.push({id:'one',title:'Saved'});data.preferences.sort='oldest';});
  const second=new Store(file);await second.load();assert.equal(second.data.bookmarks[0].title,'Saved');assert.equal(second.data.preferences.sort,'oldest');
});
