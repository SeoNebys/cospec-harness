import { describe,expect,it } from 'vitest';
import { createTestDatabase } from '../../fixtures/database.js';
import { IconStore } from '../../../src/server/metadata/icon-store.js';
import { MetadataService } from '../../../src/server/metadata/metadata-service.js';
import { FetchFailure } from '../../../src/server/metadata/safe-fetch.js';

describe('metadata service fallbacks',()=>{
  it('turns a timeout into a saveable hostname fallback',async()=>{const test=createTestDatabase();test.migrate();const service=new MetadataService(new IconStore(test.db),async()=>{throw new FetchFailure('timeout','slow')});const result=await service.retrieve('1','https://news.site.com/story');expect(result).toMatchObject({status:'unavailable',metadata:{title:{value:'news.site.com',source:'fallback'},description:null}});test.cleanup()});
  it('keeps a final safe URL and stages no invalid icon',async()=>{const test=createTestDatabase();test.migrate();let call=0;const service=new MetadataService(new IconStore(test.db),async()=>{call++;if(call===1)return{body:Buffer.from('<title>Story</title><link rel="icon" href="/bad.svg">'),finalUrl:'https://news.site.com/story',contentType:'text/html'};return{body:Buffer.from('<svg/>'),finalUrl:'https://news.site.com/bad.svg',contentType:'image/svg+xml'}});const result=await service.retrieve('2','https://news.site.com/story');expect(result.status).toBe('partial');expect(result.metadata.iconUploadToken).toBeNull();test.cleanup()});
});
