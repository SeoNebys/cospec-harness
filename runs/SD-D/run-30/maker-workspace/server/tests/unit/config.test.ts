import { describe,expect,it } from 'vitest';import { loadConfig } from '../../src/config.js';
describe('configuration',()=>{it('uses review-safe defaults',()=>expect(loadConfig({})).toMatchObject({host:'0.0.0.0',port:4000,metadataTimeoutMs:8000,maxHtmlBytes:2097152,maxImageBytes:2097152}));it('rejects invalid ports',()=>expect(()=>loadConfig({PORT:'nope'})).toThrow())});
