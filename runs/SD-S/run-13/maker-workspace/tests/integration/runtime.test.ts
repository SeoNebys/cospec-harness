import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/db/bookmarkRepository.js';
import { createDatabase } from '../../src/server/db/database.js';

let directory = '';
afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); directory = ''; });
describe('production runtime', () => {
  it('persists through restart and serves built assets with client fallback', async () => {
    directory = mkdtempSync(join(tmpdir(), 'keepmark-'));
    const path = join(directory, 'bookmarks.sqlite');
    let db = createDatabase(path);
    new BookmarkRepository(db).create({ url:'example.com', title:'Persistent', description:null, notes:null, tags:[], isFavorite:false, allowDuplicate:false });
    db.close();
    db = createDatabase(path);
    expect(new BookmarkRepository(db).list().total).toBe(1);
    const app = await buildApp({ db, clientPath: join(process.cwd(), 'dist/client') });
    expect((await app.inject({ url:'/some/client/path' })).headers['content-type']).toContain('text/html');
    expect((await app.inject({ method:'DELETE', url:'/api/bookmarks/not-found' })).statusCode).toBe(404);
    await app.close(); db.close();
  });
});
