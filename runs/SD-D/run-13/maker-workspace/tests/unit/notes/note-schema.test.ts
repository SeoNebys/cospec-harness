import { describe,expect,it } from 'vitest';
import { EMPTY_NOTE,validateNote } from '../../../src/shared/notes/schema.js';
import { noteToPlainText } from '../../../src/shared/notes/to-plain-text.js';

describe('rich notes',()=>{
  it('accepts and projects approved structure',()=>{const note=validateNote({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Context',marks:[{type:'bold'}]}]},{type:'paragraph',content:[{type:'text',text:'Read this',marks:[{type:'link',attrs:{href:'https://example.com'}}]}]}]});expect(noteToPlainText(note)).toBe('Context\nRead this');});
  it('accepts the canonical empty note',()=>expect(validateNote(EMPTY_NOTE)).toEqual(EMPTY_NOTE));
  it.each([
    {type:'doc',content:[{type:'script',content:[]}]},
    {type:'doc',content:[{type:'heading',attrs:{level:1},content:[]}]},
    {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]},
    {type:'doc',content:[{type:'paragraph',html:'<script>x</script>'}]},
  ])('rejects unsafe or unsupported documents %#',(note)=>expect(()=>validateNote(note)).toThrow());
});
