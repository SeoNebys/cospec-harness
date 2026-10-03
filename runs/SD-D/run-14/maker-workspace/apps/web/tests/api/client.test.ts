import{expect,it}from'vitest';import{api}from'../../src/api/client';it('exposes the typed bookmark operations',()=>expect(typeof api.list).toBe('function'));
