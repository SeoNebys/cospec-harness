import { describe,expect,it } from 'vitest';
import { matchesSearch } from '../../../src/shared/search/evaluator.js';
import { parseSearch } from '../../../src/shared/search/parser.js';
const record={title:'Design Systems',url:'https://example.com/a',description:'An ACCESSIBILITY guide',notesText:'Team reference',tags:['Work Notes','Research']};
describe('search evaluator',()=>{
  it.each(['design','SYSTEM','access','reference','tag:research','"design systems"','accessibility AND tag:"work notes"','missing OR research'])('matches %s',(query)=>expect(matchesSearch(parseSearch(query),record)).toBe(true));
  it.each(['"systems design"','tag:res','missing AND research'])('does not match %s',(query)=>expect(matchesSearch(parseSearch(query),record)).toBe(false));
});
