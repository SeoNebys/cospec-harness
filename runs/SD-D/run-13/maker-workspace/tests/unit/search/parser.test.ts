import { describe,expect,it } from 'vitest';
import { parseSearch,SearchSyntaxError } from '../../../src/shared/search/parser.js';

describe('search parser',()=>{
  it('applies implicit AND and AND precedence',()=>expect(parseSearch('design OR usability tag:research')).toEqual({type:'or',left:{type:'text',value:'design'},right:{type:'and',left:{type:'text',value:'usability'},right:{type:'tag',value:'research'}}}));
  it('supports phrases, quoted tags, grouping, and escapes',()=>expect(parseSearch('(“x”)'.replaceAll('“','"').replaceAll('”','"'))).toEqual({type:'text',value:'x'}));
  it('parses the approved complex example',()=>expect(parseSearch('(design OR usability) AND tag:"work notes"')).toMatchObject({type:'and',right:{type:'tag',value:'work notes'}}));
  it.each(['""','()','unclosed "phrase','term OR','term AND','\\'])('rejects malformed input: %s',(value)=>expect(()=>parseSearch(value)).toThrow(SearchSyntaxError));
  it('reports zero-based ranges',()=>{try{parseSearch('ok OR');}catch(error){expect(error).toBeInstanceOf(SearchSyntaxError);expect((error as SearchSyntaxError).start).toBe(3);expect((error as SearchSyntaxError).end).toBe(5);}});
});
