import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { query, pool } from './db.js';
import { allocateBudget, suggestRebalance } from './budget.js';
import {
  requireAuth, requireAdmin, signToken, normalizePhone, createLoginCode, checkLoginCode, publicUser, hashPassword, checkPassword,
  passwordProblem, normalizeEmail, tooMany, recordAttempt, clearAttempts, newResetToken, hashToken, SUSPENDED_MESSAGE,
} from './auth.js';
import { mails } from './mailer.js';
import adminRouter from './admin.js';
import { initializeTransaction, isValidWebhook } from './paystack.js';
import multer from 'multer';
import { sniff, LIMITS } from './sniff.js';
import { saveFile, removeFile, UPLOAD_DIR } from './storage.js';
import 'express-async-errors';
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));

// Portfolio files saved on this computer (development). Online, they live in Supabase Storage instead.
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

// Emails after a deposit is confirmed. Runs after the webhook has already answered Paystack, and never throws.
async function sendDepositEmails(bookingId, amount, points) {
  try {
    const { rows } = await query(
      `SELECT e.id AS event_id, e.title, v.business_name, pu.email AS planner_email, pu.name AS planner_name, vu.email AS vendor_email
       FROM bookings b JOIN events e ON e.id=b.event_id JOIN vendors v ON v.id=b.vendor_id
       JOIN users pu ON pu.id=e.user_id LEFT JOIN users vu ON vu.id=v.owner_user_id WHERE b.id=$1`,
      [bookingId]
    );
    if (!rows.length) return;
    const r = rows[0];
    mails.depositPaidPlanner({ plannerEmail: r.planner_email, plannerName: r.planner_name, vendorName: r.business_name, eventTitle: r.title, amount, points, eventId: r.event_id });
    mails.depositPaidVendor({ vendorEmail: r.vendor_email, vendorName: r.business_name, eventTitle: r.title, amount });
  } catch (e) {
    console.error('Deposit emails failed:', e.message);
  }
}

// Paystack webhook needs the raw body for signature verification, so it is mounted before express.json().
app.post('/api/webhooks/paystack', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature || !isValidWebhook(req.body, signature)) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString('utf8'));
  if (event.event !== 'charge.success') return res.sendStatus(200);

  const reference = event.data.reference;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = await client.query(
      `SELECT * FROM transactions WHERE reference=$1 FOR UPDATE`,
      [reference]
    );
    if (!tx.rows.length || tx.rows[0].status === 'success') {
      await client.query('COMMIT');
      return res.sendStatus(200); // unknown or already processed
    }
    const t = tx.rows[0];
    if (event.data.amount !== Number(t.amount) * 100) {
      await client.query('ROLLBACK');
      return res.sendStatus(400);
    }
    const points = Math.floor(Number(t.amount) / 100); // 1 point per ₦100
    await client.query(
      `UPDATE transactions SET status='success', points_earned=$2 WHERE id=$1`,
      [t.id, points]
    );
    await client.query(`UPDATE users SET points = points + $2 WHERE id=$1`, [t.user_id, points]);
    const b = await client.query(
      `UPDATE bookings SET status='deposit_paid', paid_at=now() WHERE id=$1
       RETURNING event_id, category, deposit_amount`,
      [t.booking_id]
    );
    if (b.rows.length) {
      await client.query(
        `UPDATE event_categories SET spent_amount = spent_amount + $3
         WHERE event_id=$1 AND category=$2`,
        [b.rows[0].event_id, b.rows[0].category, b.rows[0].deposit_amount]
      );
    }
    await client.query('COMMIT');
    res.sendStatus(200);
    sendDepositEmails(t.booking_id, Number(t.amount), points);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

app.use(express.json());

// A planner can rate a vendor once the vendor marks the job done, or once the event date has passed
// (so a vendor who forgets to tap "Mark as done" can still be reviewed). Needs bookings as b and events as e.
const REVIEWABLE_SQL = `(b.status = 'completed' OR (b.status = 'deposit_paid' AND e.event_date IS NOT NULL
  AND e.event_date < (now() AT TIME ZONE 'Africa/Lagos')::date))`;

app.use('/api/admin', requireAuth, requireAdmin, adminRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- Auth: email + password, or a code emailed to you ----
const PUBLIC_ROLES = ['planner', 'vendor'];

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = normalizeEmail(req.body.email);
  const rawPhone = String(req.body.phone || '').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const role = req.body.role === 'vendor' ? 'vendor' : 'planner';
  if (!name) return res.status(400).json({ error: 'Enter your name.' });
  if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (rawPhone && !phone) return res.status(400).json({ error: 'Enter a valid Nigerian phone number, or leave it empty.' });
  const bad = passwordProblem(req.body.password);
  if (bad) return res.status(400).json({ error: bad });

  const taken = await query('SELECT email, phone FROM users WHERE lower(email)=$1 OR ($2::text IS NOT NULL AND phone=$2)', [email, phone]);
  if (taken.rows.some((r) => r.email && r.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'That email already has an account. Sign in instead.' });
  }
  if (taken.rows.length) {
    return res.status(409).json({ error: 'That phone number is already used by another account.' });
  }
  let user;
  try {
    ({ rows: [user] } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role, last_login_at) VALUES ($1,$2,$3,$4,$5,now()) RETURNING *`,
      [name, email, phone, hashPassword(String(req.body.password)), role]
    ));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email or phone number already has an account. Sign in instead.' });
    throw e;
  }
  mails.welcome(user);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const key = `login:${req.ip}:${email || ''}`;
  if (tooMany(key, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many tries. Wait 15 minutes, or reset your password.' });
  }
  const { rows } = email ? await query('SELECT * FROM users WHERE lower(email)=$1', [email]) : { rows: [] };
  const u = rows[0];
  // Same message for "no such email" and "wrong password" so nobody can probe which emails exist.
  if (!u || !u.password_hash || !checkPassword(password, u.password_hash)) {
    recordAttempt(key);
    return res.status(401).json({ error: 'Email or password is wrong. You can reset your password if you forgot it.' });
  }
  if (u.status === 'suspended') return res.status(403).json({ error: SUSPENDED_MESSAGE });
  clearAttempts(key);
  await query('UPDATE users SET last_login_at=now() WHERE id=$1', [u.id]);
  res.json({ token: signToken(u), user: publicUser(u) });
});

app.post('/api/auth/forgot', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const key = `forgot:${req.ip}`;
  if (tooMany(key, 5, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  recordAttempt(key);
  if (email) {
    const { rows } = await query(`SELECT * FROM users WHERE lower(email)=$1 AND status='active'`, [email]);
    if (rows.length) {
      const { token, hash } = newResetToken();
      await query(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '60 minutes')`, [rows[0].id, hash]);
      mails.passwordReset(rows[0], token);
    }
  }
  // Always the same answer, whether or not the email has an account.
  res.json({ ok: true });
});

app.post('/api/auth/reset', async (req, res) => {
  const bad = passwordProblem(req.body.password);
  if (bad) return res.status(400).json({ error: bad });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `UPDATE password_resets SET used=true WHERE token_hash=$1 AND used=false AND expires_at > now() RETURNING user_id`,
      [hashToken(req.body.token)]
    );
    if (!found.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    }
    const upd = await client.query(`UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING *`, [found.rows[0].user_id, hashPassword(String(req.body.password))]);
    await client.query(`UPDATE password_resets SET used=true WHERE user_id=$1`, [found.rows[0].user_id]);
    await client.query('COMMIT');
    mails.passwordChanged(upd.rows[0]);
    if (upd.rows[0].status === 'suspended') return res.status(403).json({ error: SUSPENDED_MESSAGE });
    res.json({ token: signToken(upd.rows[0]), user: publicUser(upd.rows[0]) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

// Passwordless sign-in: a 6-digit code goes to the email on the account.
app.post('/api/auth/request-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
  const key = `code:${email}`;
  if (tooMany(key, 5, 10 * 60 * 1000) || tooMany(`codeip:${req.ip}`, 20, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many codes requested. Wait 10 minutes and try again.' });
  }
  recordAttempt(key);
  recordAttempt(`codeip:${req.ip}`);
  const { rows } = await query(`SELECT name FROM users WHERE lower(email)=$1 AND status='active'`, [email]);
  if (rows.length) mails.loginCode({ email, name: rows[0].name, code: await createLoginCode(email) });
  // Same answer whether or not the email has an account, so nobody can probe which emails exist.
  res.json({ ok: true });
});

app.post('/api/auth/verify-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code from your email.' });
  const key = `codeverify:${email}`;
  if (tooMany(key, 8, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many wrong codes. Wait 10 minutes and try again.' });
  if (!(await checkLoginCode(email, code))) {
    recordAttempt(key);
    return res.status(400).json({ error: 'That code is wrong or expired. Request a new one.' });
  }
  clearAttempts(key);
  const { rows } = await query(`UPDATE users SET last_login_at=now() WHERE lower(email)=$1 RETURNING *`, [email]);
  if (!rows.length) return res.status(400).json({ error: 'That code is wrong or expired. Request a new one.' });
  if (rows[0].status === 'suspended') return res.status(403).json({ error: SUSPENDED_MESSAGE });
  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id=$1', [req.userId]);
  res.json(publicUser(rows[0]));
});

// Update name, email, phone or password on your own account.
app.post('/api/me/credentials', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id=$1', [req.userId]);
  const u = rows[0];
  const updates = [];
  const params = [req.userId];
  const name = String(req.body.name ?? '').trim().slice(0, 80);
  if (name) { params.push(name); updates.push(`name=$${params.length}`); }

  if (req.body.phone !== undefined) {
    const raw = String(req.body.phone || '').trim();
    const phone = raw ? normalizePhone(raw) : null;
    if (raw && !phone) return res.status(400).json({ error: 'Enter a valid Nigerian phone number, or leave it empty.' });
    if (phone && phone !== u.phone) {
      const clash = await query('SELECT 1 FROM users WHERE phone=$1 AND id<>$2', [phone, req.userId]);
      if (clash.rows.length) return res.status(409).json({ error: 'That phone number is already used by another account.' });
    }
    if (phone !== u.phone) { params.push(phone); updates.push(`phone=$${params.length}`); }
  }

  const wantsPassword = !!req.body.password;
  if (wantsPassword) {
    if (u.password_hash && !checkPassword(String(req.body.current_password || ''), u.password_hash)) {
      return res.status(400).json({ error: 'Your current password is wrong.' });
    }
    const bad = passwordProblem(req.body.password);
    if (bad) return res.status(400).json({ error: bad });
    params.push(hashPassword(String(req.body.password)));
    updates.push(`password_hash=$${params.length}`);
  }
  if (req.body.email !== undefined && req.body.email !== '') {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (email !== (u.email || '').toLowerCase()) {
      const clash = await query('SELECT 1 FROM users WHERE lower(email)=$1 AND id<>$2', [email, req.userId]);
      if (clash.rows.length) return res.status(409).json({ error: 'That email is already used by another account.' });
      params.push(email);
      updates.push(`email=$${params.length}`);
    }
  }
  if (wantsPassword && !(u.email || updates.some((x) => x.startsWith('email')))) {
    return res.status(400).json({ error: 'Add your email first so you can sign in with it.' });
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to save.' });
  let saved;
  try {
    ({ rows: [saved] } = await query(`UPDATE users SET ${updates.join(', ')} WHERE id=$1 RETURNING *`, params));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email is already used by another account.' });
    throw e;
  }
  if (wantsPassword && saved.email) mails.passwordChanged(saved);
  res.json(publicUser(saved));
});

// ---- Budget preview (no auth, powers the wizard) ----
app.post('/api/budget/preview', (req, res) => {
  try {
    res.json(allocateBudget(req.body.type, Number(req.body.total)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---- Events ----
app.get('/api/events', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT e.*, COALESCE(SUM(c.spent_amount),0)::bigint AS spent_total
     FROM events e LEFT JOIN event_categories c ON c.event_id = e.id
     WHERE e.user_id=$1 GROUP BY e.id ORDER BY e.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

app.post('/api/events', requireAuth, async (req, res) => {
  const { title, type, event_date, budget_total, categories } = req.body;
  let plan;
  try {
    plan = categories?.length
      ? categories
      : allocateBudget(type, Number(budget_total));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query(
      `INSERT INTO events (user_id, title, type, event_date, budget_total)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId, title || `My ${type}`, type, event_date || null, Math.round(Number(budget_total))]
    );
    for (const c of plan) {
      await client.query(
        `INSERT INTO event_categories (event_id, category, allocated_amount) VALUES ($1,$2,$3)`,
        [ev.rows[0].id, c.category, Math.round(c.amount)]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(ev.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: "Couldn't create your event. Try again." });
  } finally {
    client.release();
  }
});

app.get('/api/events/:id', requireAuth, async (req, res) => {
  const ev = await query('SELECT * FROM events WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (!ev.rows.length) return res.status(404).json({ error: 'Event not found.' });
  const cats = await query('SELECT * FROM event_categories WHERE event_id=$1 ORDER BY allocated_amount DESC', [req.params.id]);
  const bookings = await query(
    `SELECT b.*, v.business_name,
            CASE WHEN b.status IN ('confirmed','deposit_paid','completed') THEN v.contact_phone END AS vendor_phone,
            r.rating AS review_rating, r.comment AS review_comment,
            (r.id IS NULL AND ${REVIEWABLE_SQL}) AS can_review
     FROM bookings b
     JOIN vendors v ON v.id=b.vendor_id
     JOIN events e ON e.id=b.event_id
     LEFT JOIN reviews r ON r.booking_id=b.id
     WHERE b.event_id=$1 ORDER BY b.created_at DESC`,
    [req.params.id]
  );
  res.json({
    ...ev.rows[0],
    categories: cats.rows,
    bookings: bookings.rows,
    tips: suggestRebalance(cats.rows),
  });
});

// ---- Vendors ----
app.get('/api/vendors', async (req, res) => {
  const { category, city = 'Lagos', max_price } = req.query;
  const params = [city];
  let sql = `SELECT v.*,
      (SELECT count(*) FROM vendor_media m WHERE m.vendor_id = v.id)::int AS media_count,
      COALESCE((SELECT json_agg(row_to_json(p)) FROM
        (SELECT id, kind, url FROM vendor_media m WHERE m.vendor_id = v.id ORDER BY created_at DESC LIMIT 4) p), '[]'::json) AS preview
    FROM vendors v WHERE v.active AND v.city=$1`;
  if (category) { params.push(category); sql += ` AND category=$${params.length}`; }
  if (max_price) { params.push(Number(max_price)); sql += ` AND price_from <= $${params.length}`; }
  sql += ' ORDER BY rating DESC, price_from ASC';
  res.json((await query(sql, params)).rows);
});

app.get('/api/vendors/:id/reviews', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            COALESCE(NULLIF(split_part(u.name, ' ', 1), ''), 'A planner') AS planner_name
     FROM reviews r JOIN users u ON u.id = r.planner_id
     WHERE r.vendor_id=$1 ORDER BY r.created_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json(rows);
});

app.get('/api/vendors/:id/media', async (req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.url FROM vendor_media m
     JOIN vendors v ON v.id = m.vendor_id
     WHERE m.vendor_id=$1 AND v.active ORDER BY m.created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
});

app.get('/api/vendors/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM vendors WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Vendor not found.' });
  res.json(rows[0]);
});

// ---- Bookings + deposit payment ----
app.post('/api/bookings', requireAuth, async (req, res) => {
  const { event_id, vendor_id, total_amount } = req.body;
  const owns = await query('SELECT title FROM events WHERE id=$1 AND user_id=$2', [event_id, req.userId]);
  if (!owns.rows.length) return res.status(404).json({ error: 'Event not found.' });
  const v = await query('SELECT * FROM vendors WHERE id=$1 AND active', [vendor_id]);
  if (!v.rows.length) return res.status(404).json({ error: 'Vendor not found.' });

  const dup = await query(
    `SELECT 1 FROM bookings WHERE event_id=$1 AND vendor_id=$2
     AND status IN ('requested','confirmed','deposit_paid','completed')`,
    [event_id, vendor_id]
  );
  if (dup.rows.length) {
    return res.status(409).json({ error: "You've already requested this vendor for this event." });
  }

  const total = Math.round(Number(total_amount) || Number(v.rows[0].price_from));
  const deposit = Math.round(total * 0.3); // 30% deposit
  // Sample vendors have no owner, so nobody could accept. Confirm them straight away so testing still works.
  const startStatus = v.rows[0].owner_user_id ? 'requested' : 'confirmed';
  const { rows } = await query(
    `INSERT INTO bookings (event_id, vendor_id, category, status, total_amount, deposit_amount)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [event_id, vendor_id, v.rows[0].category, startStatus, total, deposit]
  );
  if (v.rows[0].owner_user_id) {
    const parties = await query(
      `SELECT (SELECT email FROM users WHERE id=$1) AS vendor_email, (SELECT name FROM users WHERE id=$2) AS planner_name`,
      [v.rows[0].owner_user_id, req.userId]
    );
    mails.newRequest({
      vendorEmail: parties.rows[0].vendor_email, vendorName: v.rows[0].business_name,
      eventTitle: owns.rows[0].title, plannerName: parties.rows[0].planner_name,
    });
  }
  res.status(201).json(rows[0]);
});

app.post('/api/bookings/:id/pay-deposit', requireAuth, async (req, res) => {
  const b = await query(
    `SELECT b.* FROM bookings b JOIN events e ON e.id=b.event_id
     WHERE b.id=$1 AND e.user_id=$2`,
    [req.params.id, req.userId]
  );
  if (!b.rows.length) return res.status(404).json({ error: 'Booking not found.' });
  const status = b.rows[0].status;
  if (status === 'deposit_paid') return res.status(400).json({ error: 'This deposit is already paid.' });
  if (status === 'requested') {
    return res.status(400).json({ error: 'Wait for the vendor to accept your request before paying a deposit.' });
  }
  if (status !== 'confirmed') {
    return res.status(400).json({ error: "This booking can't take a deposit." });
  }

  const user = (await query('SELECT * FROM users WHERE id=$1', [req.userId])).rows[0];
  const email = user.email || `${String(user.phone || user.id).replace(/\D/g, '')}@lyf.app`;
  const reference = `lyf_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    const init = await initializeTransaction({
      email,
      amountNaira: Number(b.rows[0].deposit_amount),
      reference,
      metadata: { booking_id: b.rows[0].id },
      callbackUrl: `${process.env.CLIENT_URL}/events/${b.rows[0].event_id}`,
    });
    await query(
      `INSERT INTO transactions (user_id, booking_id, reference, amount) VALUES ($1,$2,$3,$4)`,
      [req.userId, b.rows[0].id, reference, b.rows[0].deposit_amount]
    );
    res.json({ authorization_url: init.authorization_url, reference });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Couldn't start the payment. Try again." });
  }
});
app.post('/api/bookings/:id/review', requireAuth, async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
  }
  const comment = String(req.body.comment || '').trim();
  if (comment.length > 500) return res.status(400).json({ error: 'Keep your comment under 500 characters.' });

  const found = await query(
    `SELECT b.id, b.vendor_id, ${REVIEWABLE_SQL} AS reviewable,
            EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
     FROM bookings b JOIN events e ON e.id = b.event_id
     WHERE b.id=$1 AND e.user_id=$2`,
    [req.params.id, req.userId]
  );
  if (!found.rows.length) return res.status(404).json({ error: 'Booking not found.' });
  const b = found.rows[0];
  if (b.reviewed) return res.status(409).json({ error: "You've already rated this vendor for this event." });
  if (!b.reviewable) {
    return res.status(400).json({ error: 'You can rate a vendor once the job is done or your event date has passed.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO reviews (booking_id, vendor_id, planner_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, rating, comment, created_at`,
      [b.id, b.vendor_id, req.userId, rating, comment || null]
    );
    await client.query(
      `UPDATE vendors SET
         rating = (SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE vendor_id=$1),
         review_count = (SELECT count(*) FROM reviews WHERE vendor_id=$1)
       WHERE id=$1`,
      [b.vendor_id]
    );
    await client.query('COMMIT');
    const owner = await query(
      `SELECT u.email FROM vendors v JOIN users u ON u.id = v.owner_user_id WHERE v.id=$1`,
      [b.vendor_id]
    );
    if (owner.rows.length) mails.newReview({ vendorEmail: owner.rows[0].email, rating, comment: comment || null });
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: "You've already rated this vendor for this event." });
    throw e;
  } finally {
    client.release();
  }
});

app.post('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  const { rows } = await query(
    `UPDATE bookings b SET status='cancelled'
     FROM events e
     WHERE b.id=$1 AND e.id=b.event_id AND e.user_id=$2 AND b.status IN ('requested','confirmed')
     RETURNING b.*`,
    [req.params.id, req.userId]
  );
  if (!rows.length) {
    return res.status(400).json({ error: "This booking can't be cancelled. Paid deposits need to be settled with the vendor." });
  }
  res.json(rows[0]);
});

// ---- Vendor side ----
async function requireVendor(req, res, next) {
  const { rows } = await query('SELECT role, phone FROM users WHERE id=$1', [req.userId]);
  if (!rows.length || rows[0].role !== 'vendor') {
    return res.status(403).json({ error: 'This area is for vendor accounts.' });
  }
  req.userPhone = rows[0].phone;
  next();
}

const VENDOR_CATEGORIES = ['venue', 'food', 'photography', 'makeup', 'dj', 'aso-ebi', 'decoration'];

app.get('/api/vendor/me', requireAuth, requireVendor, async (req, res) => {
  const { rows } = await query(
    `SELECT v.*, (SELECT count(*) FROM vendor_media m WHERE m.vendor_id = v.id)::int AS media_count
     FROM vendors v WHERE v.owner_user_id=$1`,
    [req.userId]
  );
  res.json(rows[0] || null);
});

// ---- Vendor portfolio (photos and videos) ----
const MAX_MEDIA_PER_VENDOR = 30;
const uploadOne = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.video, files: 1 } }).single('file');

app.get('/api/vendor/media', requireAuth, requireVendor, async (req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.url FROM vendor_media m
     JOIN vendors v ON v.id = m.vendor_id
     WHERE v.owner_user_id=$1 ORDER BY m.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

app.post('/api/vendor/media', requireAuth, requireVendor, uploadOne, async (req, res) => {
  const vendor = (await query('SELECT id FROM vendors WHERE owner_user_id=$1', [req.userId])).rows[0];
  if (!vendor) return res.status(400).json({ error: 'Set up your business before adding work.' });
  if (!req.file) return res.status(400).json({ error: 'Choose a photo or video to upload.' });

  const type = sniff(req.file.buffer);
  if (type?.unsupported === 'heic') {
    return res.status(400).json({ error: "That photo is in HEIC format. Choose a JPEG or PNG, or set your camera to 'Most Compatible'." });
  }
  if (!type) return res.status(400).json({ error: 'Upload a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.' });
  if (req.file.size > LIMITS[type.kind]) {
    return res.status(413).json({
      error: type.kind === 'image' ? 'Photos can be up to 10 MB each.' : 'Videos can be up to 50 MB each. Trim or compress it first.',
    });
  }

  const count = Number((await query('SELECT count(*) FROM vendor_media WHERE vendor_id=$1', [vendor.id])).rows[0].count);
  if (count >= MAX_MEDIA_PER_VENDOR) {
    return res.status(400).json({ error: `You can show up to ${MAX_MEDIA_PER_VENDOR} photos and videos. Delete one to add another.` });
  }

  const saved = await saveFile({ buffer: req.file.buffer, ext: type.ext, mime: type.mime, vendorId: vendor.id });
  try {
    const { rows } = await query(
      `INSERT INTO vendor_media (vendor_id, kind, url, storage_path) VALUES ($1,$2,$3,$4)
       RETURNING id, kind, url`,
      [vendor.id, type.kind, saved.url, saved.path]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    await removeFile(saved.path);
    throw e;
  }
});

app.delete('/api/vendor/media/:id', requireAuth, requireVendor, async (req, res) => {
  const { rows } = await query(
    `DELETE FROM vendor_media m USING vendors v
     WHERE m.id=$1 AND v.id=m.vendor_id AND v.owner_user_id=$2
     RETURNING m.storage_path`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'That item was already removed.' });
  await removeFile(rows[0].storage_path);
  res.json({ ok: true });
});

app.post('/api/vendor/profile', requireAuth, requireVendor, async (req, res) => {
  const { business_name, category, city, price_from, price_to, description, contact_phone } = req.body;
  if (!String(business_name || '').trim()) return res.status(400).json({ error: 'Enter your business name.' });
  if (!VENDOR_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Pick what you offer.' });
  const from = Math.round(Number(price_from));
  if (!from || from <= 0) return res.status(400).json({ error: 'Enter the lowest price you charge.' });
  const to = price_to ? Math.round(Number(price_to)) : null;
  if (to !== null && to < from) return res.status(400).json({ error: 'Your highest price must be above your lowest.' });

  const phone = normalizePhone(contact_phone) || req.userPhone;
  const { rows } = await query(
    `INSERT INTO vendors (business_name, category, city, price_from, price_to, description, contact_phone, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (owner_user_id) WHERE owner_user_id IS NOT NULL DO UPDATE SET
       business_name=EXCLUDED.business_name, category=EXCLUDED.category, city=EXCLUDED.city,
       price_from=EXCLUDED.price_from, price_to=EXCLUDED.price_to,
       description=EXCLUDED.description, contact_phone=EXCLUDED.contact_phone
     RETURNING *`,
    [String(business_name).trim(), category, String(city || 'Lagos').trim(), from, to,
     String(description || '').trim() || null, phone, req.userId]
  );
  res.json(rows[0]);
});

app.get('/api/vendor/bookings', requireAuth, requireVendor, async (req, res) => {
  const { rows } = await query(
    `SELECT b.id, b.status, b.total_amount, b.deposit_amount, b.vendor_note, b.created_at, b.paid_at,
            e.title AS event_title, e.type AS event_type, e.event_date,
            u.name AS planner_name,
            CASE WHEN b.status IN ('confirmed','deposit_paid','completed') THEN u.phone END AS planner_phone
     FROM bookings b
     JOIN vendors v ON v.id=b.vendor_id
     JOIN events e ON e.id=b.event_id
     JOIN users u ON u.id=e.user_id
     WHERE v.owner_user_id=$1
     ORDER BY CASE b.status WHEN 'requested' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'deposit_paid' THEN 2 ELSE 3 END,
              b.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

app.post('/api/vendor/bookings/:id/respond', requireAuth, requireVendor, async (req, res) => {
  const { action, total_amount, note } = req.body;
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Choose accept or decline.' });

  const found = await query(
    `SELECT b.*, e.title, u.phone AS planner_phone, u.email AS planner_email, u.name AS planner_name, v.business_name
     FROM bookings b
     JOIN vendors v ON v.id=b.vendor_id
     JOIN events e ON e.id=b.event_id
     JOIN users u ON u.id=e.user_id
     WHERE b.id=$1 AND v.owner_user_id=$2`,
    [req.params.id, req.userId]
  );
  if (!found.rows.length) return res.status(404).json({ error: 'Booking not found.' });
  const b = found.rows[0];
  if (b.status !== 'requested') return res.status(400).json({ error: 'You already responded to this request.' });

  const cleanNote = String(note || '').trim().slice(0, 300) || null;
  let total = Number(b.total_amount);
  if (action === 'accept' && total_amount !== undefined && total_amount !== '') {
    total = Math.round(Number(total_amount));
    if (!total || total <= 0) return res.status(400).json({ error: 'Enter a price above zero.' });
  }
  const deposit = Math.round(total * 0.3);

  const { rows } = await query(
    `UPDATE bookings SET status=$2, total_amount=$3, deposit_amount=$4, vendor_note=$5, responded_at=now()
     WHERE id=$1 AND status='requested' RETURNING *`,
    [b.id, action === 'accept' ? 'confirmed' : 'declined', total, deposit, cleanNote]
  );
  if (!rows.length) return res.status(400).json({ error: 'You already responded to this request.' });

  mails.requestAnswered({
    plannerEmail: b.planner_email, plannerName: b.planner_name, vendorName: b.business_name, eventTitle: b.title,
    accepted: action === 'accept', total, deposit, note: cleanNote, eventId: b.event_id,
  });
  res.json(rows[0]);
});

app.post('/api/vendor/bookings/:id/complete', requireAuth, requireVendor, async (req, res) => {
  const { rows } = await query(
    `UPDATE bookings b SET status='completed'
     FROM vendors v
     WHERE b.id=$1 AND v.id=b.vendor_id AND v.owner_user_id=$2 AND b.status='deposit_paid'
     RETURNING b.*`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(400).json({ error: 'Only bookings with a paid deposit can be marked done.' });
  res.json(rows[0]);
});

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That file is too large. Photos can be up to 10 MB and videos up to 50 MB.' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Upload one photo or video at a time.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Lyf API running on :${port}`));
