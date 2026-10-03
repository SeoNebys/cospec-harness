import { createApp } from '../../src/server/app.js';
import { createTemporaryDatabase } from './database.js';

export function createTestApp() {
  const temporary = createTemporaryDatabase();
  return {
    app: createApp(temporary.db),
    db: temporary.db,
    databasePath: temporary.path,
    close: temporary.close,
  };
}
