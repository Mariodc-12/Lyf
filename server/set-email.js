// Usage: npm run set-email -- 08012345678 you@example.com
// Adds an email to an account that was created with a phone code, so its owner can sign in again
// with a code emailed to that address.
import 'dotenv/config';
import { query, pool } from './src/db.js';
import { normalizePhone, normalizeEmail } from './src/auth.js';

const phone = normalizePhone(process.argv[2]);
const email = normalizeEmail(process.argv[3]);
if (!phone || !email) {
  console.error('Usage: npm run set-email -- 08012345678 you@example.com');
  process.exit(1);
}
try {
  const { rows } = await query(`UPDATE users SET email=$2 WHERE phone=$1 AND email IS NULL RETURNING name`, [phone, email]);
  if (!rows.length) {
    console.error('No account with that phone number and no email yet. Nothing changed.');
    process.exitCode = 1;
  } else {
    console.log(`Done. ${rows[0].name || 'That account'} can now sign in at ${email} with an emailed code.`);
  }
} catch (e) {
  console.error(e.code === '23505' ? 'That email already belongs to another account.' : e.message);
  process.exitCode = 1;
}
await pool.end();
