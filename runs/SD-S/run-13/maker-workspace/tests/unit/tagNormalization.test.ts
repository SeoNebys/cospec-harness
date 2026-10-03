import { describe,expect,it } from 'vitest';import { normalizeTags } from '../../src/shared/tagNormalization.js';
describe('tags',()=>{it('trims and case-folds duplicates',()=>expect(normalizeTags([' Work ','work','Read'])).toEqual(['Work','Read']));it('enforces the count',()=>expect(()=>normalizeTags(Array.from({length:21},(_,i)=>`t${i}`))).toThrow());});
