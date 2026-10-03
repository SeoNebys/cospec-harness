import { describe,expect,it } from 'vitest';import { parseSearch } from '../../src/search/parser.js';
describe('search contract grammar',()=>{it('keeps v1 operator precedence stable',()=>expect(parseSearch('#work OR "read later" NOT draft')).toHaveLength(2))});
