// Usage: npm run make-admin -- someone@example.com
// Turns an existing account into an admin. The person must register first.
import 'dotenv/config';
import { query, pool } from './src/db.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run make-admin -- someone@example.com');
  process.exit(1);
}
const { rows } = await query(`UPDATE users SET role='admin' WHERE lower(email)=$1 RETURNING name, email`, [email]);
if (!rows.length) {
  console.error(`No account with the email ${email}. Register it in the app first, then run this again.`);
  process.exitCode = 1;
} else {
  console.log(`${rows[0].email} is now an admin. Sign in and open /admin.`);
}
await pool.end();
