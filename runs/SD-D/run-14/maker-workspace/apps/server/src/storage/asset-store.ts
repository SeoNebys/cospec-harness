import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Config } from '../config.js';

export class AssetStore {
  readonly root: string;
  constructor(config: Config) { this.root = path.join(config.dataDir, 'assets'); fs.mkdirSync(this.root, { recursive: true }); }
  pathFor(relative: string): string {
    if (!/^[a-f0-9-]+\.(webp|png|jpe?g|ico)$/i.test(relative)) throw new Error('Invalid asset path');
    const full = path.resolve(this.root, relative); if (!full.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid asset path'); return full;
  }
  save(buffer: Buffer, extension: 'webp'|'png'|'jpg'|'ico') {
    const id = randomUUID(); const relativePath = `${id}.${extension}`; const target = this.pathFor(relativePath); const temp = `${target}.tmp`;
    fs.writeFileSync(temp, buffer, { flag: 'wx' }); fs.renameSync(temp, target);
    return { id, relativePath, byteSize: buffer.byteLength, hash: createHash('sha256').update(buffer).digest('hex') };
  }
  remove(relative: string | null | undefined) { if (!relative) return; try { fs.unlinkSync(this.pathFor(relative)); } catch (e: any) { if (e.code !== 'ENOENT') throw e; } }
}
