import{mkdtempSync}from'node:fs';import{tmpdir}from'node:os';import path from'node:path';export const temporaryDataDir=()=>mkdtempSync(path.join(tmpdir(),'latchmark-test-'));
