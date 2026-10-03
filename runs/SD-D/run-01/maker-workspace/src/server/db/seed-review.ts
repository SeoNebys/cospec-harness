import { readEnv } from '../config/env.js';
import { openDatabase, migrate } from './database.js';
import { UserRepository } from '../repositories/user-repository.js';
import { hashPassword } from '../security/session.js';

const env = readEnv();
if (!env.reviewEmail || !env.reviewPassword) throw new Error('Set REVIEW_EMAIL and REVIEW_PASSWORD to seed a review account.');
const db = openDatabase(env.databasePath);
migrate(db);
const users = new UserRepository(db);
if (!users.byEmail(env.reviewEmail)) users.create(env.reviewEmail, await hashPassword(env.reviewPassword));
db.close();
console.log(`Review account ready: ${env.reviewEmail}`);
