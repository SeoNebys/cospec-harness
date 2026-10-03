import { describe,expect,it } from 'vitest';
import { assertPublicUrl } from '../../apps/worker/src/fetch-policy/ssrf.js';
describe('capture network boundary',()=>{it.each(['http://127.0.0.1','http://10.1.2.3','http://169.254.169.254/latest','http://[::1]','file:///etc/passwd'])('blocks private or unsupported target %s',async value=>{await expect(assertPublicUrl(value)).rejects.toThrow()})});
