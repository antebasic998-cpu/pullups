/**
 * Empty the board so you can start with real colleagues.
 *   npm run clear
 * (The demo data can always be brought back with `npm run reset`.)
 */
import { db } from './store.js';

const before = { users: db.users().length, sessions: db.sessions().length };
const force = process.argv.includes('--force');

if (!force && before.users > 0) {
  console.log(`About to delete ${before.users} athletes and ${before.sessions} results from ${db.file}.`);
  console.log('Re-run with --force to confirm:  node server/clear.js --force');
  process.exit(0);
}

db.replaceAll({ users: [], sessions: [] });
console.log(`[clear] board emptied (${before.users} athletes, ${before.sessions} results removed) → ${db.file}`);
