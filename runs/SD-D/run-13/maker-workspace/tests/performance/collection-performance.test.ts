import { describe,expect,it } from 'vitest';
import { createTestDatabase } from '../fixtures/database.js';
import { seed1000 } from '../fixtures/seed-1000.js';
import { CollectionQueryService } from '../../src/server/services/collection-query-service.js';
describe('1,000-bookmark collection performance',()=>{it('searches, filters, sorts, and pages within one second',()=>{const db=createTestDatabase();seed1000(db);const service=new CollectionQueryService(db);const started=performance.now();const result=service.list({view:'active',q:'(design OR accessibility) AND tag:work',favorite:'true',sort:'title',direction:'asc',pageSize:50});expect(performance.now()-started).toBeLessThan(1000);expect(result.total).toBeGreaterThan(0);expect(result.items.length).toBeLessThanOrEqual(50);db.close();});});
