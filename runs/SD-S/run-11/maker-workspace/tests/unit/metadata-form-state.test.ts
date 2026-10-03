import test from 'node:test';import assert from 'node:assert/strict';import {mayApplyMetadata} from '../../src/client/hooks/metadataFormState.ts';
test('only current untouched fields accept metadata',()=>{assert.equal(mayApplyMetadata('a','a',false),true);assert.equal(mayApplyMetadata('a','b',false),false);assert.equal(mayApplyMetadata('a','a',true),false)});
