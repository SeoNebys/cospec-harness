import{expect,it}from'vitest';import{loggerOptions}from'../../src/logging.js';it('redacts private bookmark and capture values',()=>expect(loggerOptions.redact).toContain('req.body.notes'));
