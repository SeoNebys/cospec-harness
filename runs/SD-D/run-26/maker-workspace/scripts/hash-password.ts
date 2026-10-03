import { hashPassword } from '../server/src/auth/password.js';
import readline from 'node:readline/promises';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stderr,
  terminal: true
});
const password = await rl.question('Password: ');
rl.close();
console.log(await hashPassword(password));
