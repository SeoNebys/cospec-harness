import { createHash } from 'node:crypto';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
const url=process.env.MONOLITH_URL, expected=process.env.MONOLITH_SHA256;
if(!url||!expected) throw new Error('Set MONOLITH_URL and MONOLITH_SHA256 to the approved pinned release');
const response=await fetch(url); if(!response.ok) throw new Error(`Download failed: ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer()); const actual=createHash('sha256').update(bytes).digest('hex');
if(actual!==expected) throw new Error(`Checksum mismatch: ${actual}`);
await mkdir('third_party/monolith/bin',{recursive:true}); await writeFile('third_party/monolith/bin/monolith',bytes); await chmod('third_party/monolith/bin/monolith',0o755);
