import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const outputDirectory = resolve(process.cwd(), 'dist');
if (outputDirectory !== resolve('/work/dist')) {
  throw new Error(`Refusing to clean unexpected path: ${outputDirectory}`);
}
rmSync(outputDirectory, { recursive: true, force: true });
