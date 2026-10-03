import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { createTestApp } from '../../fixtures/test-app.js';
import { BookmarkService } from '../../../src/server/services/bookmark-service.js';
import { MetadataDraftRepository } from '../../../src/server/db/repositories/metadata-draft-repository.js';
import { EMPTY_NOTE } from '../../../src/shared/notes/schema.js';

describe('bookmark updates',()=>{
  let fixture:Awaited<ReturnType<typeof createTestApp>>;let service:BookmarkService;
  beforeEach(async()=>{fixture=await createTestApp();service=new BookmarkService(fixture.db);});
  afterEach(()=>fixture.close());
  it('round-trips every editable field and searchable note text',()=>{
    const first=service.create({url:'https://example.com/one',title:'One',notes:EMPTY_NOTE,tags:[],favorite:false,toRead:false});
    const notes={type:'doc' as const,content:[{type:'heading' as const,attrs:{level:2 as const},content:[{type:'text' as const,text:'Project context',marks:[{type:'bold' as const}]}]}]};
    const updated=service.update(first.id,{title:'Updated',description:'New description',notes,tags:['Research',' research '],favorite:true,toRead:true});
    expect(updated).toMatchObject({title:'Updated',description:'New description',favorite:true,toRead:true,tags:[{name:'Research'}]});
    expect(fixture.db.prepare('SELECT notes_text FROM bookmarks WHERE id=?').get(first.id)).toEqual({notes_text:'Project context'});
  });
  it('attaches a matching refresh and rejects duplicates or invalid bounds atomically',()=>{
    const first=service.create({url:'https://example.com/one',title:'One',notes:EMPTY_NOTE,tags:[],favorite:false,toRead:false});
    service.create({url:'https://example.com/two',title:'Two',notes:EMPTY_NOTE,tags:[],favorite:false,toRead:false});
    const draft=new MetadataDraftRepository(fixture.db,Date.now,()=> '00000000-0000-4000-8000-000000000010').create({normalizedUrl:'https://example.com/three',sourceUrl:'https://example.com/three',finalUrl:'https://example.com/three',title:'Three',description:null,iconAssetId:null,previewAssetId:null,warnings:[]});
    expect(service.update(first.id,{url:'https://example.com/three',metadataDraftId:draft.id}).url).toBe('https://example.com/three');
    expect(()=>service.update(first.id,{url:'https://example.com/two'})).toThrow();expect(()=>service.update(first.id,{title:''})).toThrow();
    expect(service.get(first.id).title).toBe('One');
  });
});
