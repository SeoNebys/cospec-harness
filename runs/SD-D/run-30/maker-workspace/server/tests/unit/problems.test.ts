import { describe,expect,it } from 'vitest';import { HttpProblem } from '../../src/api/problems.js';
describe('problems',()=>{it('carries stable status and code',()=>expect(new HttpProblem(404,'NOT_FOUND','Missing')).toMatchObject({status:404,code:'NOT_FOUND',message:'Missing'}))});
