import express from 'express';
import { query, pool } from './db.js';
import { removeFile } from './storage.js';

// Everything here is mounted behind requireAuth + requireAdmin in index.js.
const router = express.Router();
const PAGE = 25;

async function audit(req, action, targetType, targetId, detail) {
  await query(
    `INSERT INTO admin_actions (admin_id, action, target_type, target_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [req.userId, action, targetType, String(targetId), detail || null]
  );
}

const like = (q) => `%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const page = (req) => Math.max(0, Number.parseInt(req.query.page, 10) || 0);

// ---- Overview ----
router.get('/stats', async (_req, res) => {
  const [{ rows: [t] }, { rows: byStatus }, { rows: signups }] = await Promise.all([
    query(`SELECT
      (SELECT count(*) FROM users WHERE role='planner')::int AS planners,
      (SELECT count(*) FROM users WHERE role='vendor')::int AS vendor_accounts,
      (SELECT count(*) FROM users WHERE status='suspended')::int AS suspended,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS new_users_7d,
      (SELECT count(*) FROM vendors WHERE owner_user_id IS NOT NULL)::int AS live_vendors,
      (SELECT count(*) FROM vendors WHERE owner_user_id IS NOT NULL AND NOT verified)::int AS unverified_vendors,
      (SELECT count(*) FROM events)::int AS events,
      (SELECT count(*) FROM bookings)::int AS bookings,
      (SELECT count(*) FROM reviews)::int AS reviews,
      (SELECT count(*) FROM vendor_media)::int AS media,
      (SELECT COALESCE(sum(amount),0) FROM transactions WHERE status='success')::float8 AS deposits_total,
      (SELECT count(*) FROM transactions WHERE status='success')::int AS payments,
      (SELECT count(*) FROM email_log WHERE status='failed' AND created_at > now() - interval '7 days')::int AS failed_emails_7d`),
    query(`SELECT status, count(*)::int AS n FROM bookings GROUP BY status`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS n
           FROM generate_series((now() AT TIME ZONE 'Africa/Lagos')::date - 13, (now() AT TIME ZONE 'Africa/Lagos')::date, '1 day') d
           LEFT JOIN users u ON (u.created_at AT TIME ZONE 'Africa/Lagos')::date = d::date
           GROUP BY d ORDER BY d`),
  ]);
  res.json({ ...t, bookings_by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), signups });
});

router.get('/activity', async (_req, res) => {
  const { rows } = await query(`
    SELECT * FROM (
      (SELECT created_at, 'signup' AS kind, COALESCE(name, email, phone) || ' joined as ' || CASE role WHEN 'admin' THEN 'an admin' WHEN 'vendor' THEN 'a vendor' ELSE 'a planner' END AS text FROM users ORDER BY created_at DESC LIMIT 30)
      UNION ALL
      (SELECT b.created_at, 'booking', COALESCE(u.name, 'A planner') || ' asked ' || v.business_name || ' for "' || e.title || '"'
         FROM bookings b JOIN events e ON e.id=b.event_id JOIN vendors v ON v.id=b.vendor_id JOIN users u ON u.id=e.user_id
         ORDER BY b.created_at DESC LIMIT 30)
      UNION ALL
      (SELECT t.created_at, 'payment', '₦' || to_char(t.amount, 'FM999,999,999,999') || ' deposit paid for ' || v.business_name
         FROM transactions t JOIN bookings b ON b.id=t.booking_id JOIN vendors v ON v.id=b.vendor_id
         WHERE t.status='success' ORDER BY t.created_at DESC LIMIT 30)
      UNION ALL
      (SELECT r.created_at, 'review', r.rating || '-star review for ' || v.business_name FROM reviews r JOIN vendors v ON v.id=r.vendor_id ORDER BY r.created_at DESC LIMIT 30)
      UNION ALL
      (SELECT created_at, 'admin', 'Admin: ' || action || ' (' || target_type || ')' FROM admin_actions ORDER BY created_at DESC LIMIT 30)
    ) x ORDER BY created_at DESC LIMIT 30`);
  res.json(rows);
});

// ---- Users ----
router.get('/users', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.q) { params.push(like(req.query.q)); where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`); }
  if (['planner', 'vendor', 'admin'].includes(req.query.role)) { params.push(req.query.role); where.push(`role=$${params.length}`); }
  if (req.query.status === 'suspended') where.push(`status='suspended'`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int AS n FROM users ${w}`, params)).rows[0].n;
  params.push(PAGE, page(req) * PAGE);
  const { rows } = await query(
    `SELECT id, name, email, phone, role, status, points, created_at, last_login_at, (password_hash IS NOT NULL) AS has_password,
            (SELECT count(*) FROM events e WHERE e.user_id = users.id)::int AS events
     FROM users ${w} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ total, page_size: PAGE, rows });
});

router.post('/users/:id/status', async (req, res) => {
  const status = req.body.status;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Choose active or suspended.' });
  if (req.params.id === req.userId) return res.status(400).json({ error: "You can't suspend your own account." });
  const target = await query('SELECT id, role, name, email, phone FROM users WHERE id=$1', [req.params.id]);
  if (!target.rows.length) return res.status(404).json({ error: 'User not found.' });
  if (target.rows[0].role === 'admin') return res.status(400).json({ error: "Admin accounts can't be suspended here." });
  await query('UPDATE users SET status=$2 WHERE id=$1', [req.params.id, status]);
  // A suspended vendor shouldn't stay bookable.
  await query('UPDATE vendors SET active=$2 WHERE owner_user_id=$1', [req.params.id, status === 'active']);
  await audit(req, status === 'suspended' ? 'suspended user' : 'reactivated user', 'user', req.params.id, target.rows[0].email || target.rows[0].phone);
  res.json({ ok: true, status });
});

// ---- Vendors ----
router.get('/vendors', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.q) { params.push(like(req.query.q)); where.push(`(v.business_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
  if (req.query.filter === 'unverified') where.push(`v.owner_user_id IS NOT NULL AND NOT v.verified`);
  if (req.query.filter === 'hidden') where.push(`NOT v.active`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int AS n FROM vendors v LEFT JOIN users u ON u.id=v.owner_user_id ${w}`, params)).rows[0].n;
  params.push(PAGE, page(req) * PAGE);
  const { rows } = await query(
    `SELECT v.id, v.business_name, v.category, v.city, v.price_from, v.rating, v.review_count, v.active, v.verified,
            v.owner_user_id, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
            (SELECT count(*) FROM vendor_media m WHERE m.vendor_id=v.id)::int AS media_count,
            (SELECT count(*) FROM bookings b WHERE b.vendor_id=v.id)::int AS bookings
     FROM vendors v LEFT JOIN users u ON u.id=v.owner_user_id ${w}
     ORDER BY (v.owner_user_id IS NOT NULL AND NOT v.verified) DESC, v.business_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ total, page_size: PAGE, rows });
});

async function setVendorFlag(req, res, column, label) {
  const value = !!req.body.value;
  const { rows } = await query(`UPDATE vendors SET ${column}=$2 WHERE id=$1 RETURNING business_name`, [req.params.id, value]);
  if (!rows.length) return res.status(404).json({ error: 'Vendor not found.' });
  await audit(req, `${value ? '' : 'un'}${label}`, 'vendor', req.params.id, rows[0].business_name);
  res.json({ ok: true, value });
}
router.post('/vendors/:id/verified', (req, res) => setVendorFlag(req, res, 'verified', 'verified vendor'));
router.post('/vendors/:id/active', (req, res) => {
  req.body.value = !!req.body.value;
  return setVendorFlag(req, res, 'active', 'activated vendor');
});

// ---- Bookings and payments ----
router.get('/bookings', async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.status) { params.push(req.query.status); where.push(`b.status=$${params.length}`); }
  if (req.query.q) { params.push(like(req.query.q)); where.push(`(e.title ILIKE $${params.length} OR v.business_name ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM bookings b JOIN events e ON e.id=b.event_id JOIN vendors v ON v.id=b.vendor_id JOIN users u ON u.id=e.user_id ${w}`;
  const total = (await query(`SELECT count(*)::int AS n ${base}`, params)).rows[0].n;
  params.push(PAGE, page(req) * PAGE);
  const { rows } = await query(
    `SELECT b.id, b.status, b.total_amount, b.deposit_amount, b.created_at, b.paid_at,
            e.title AS event_title, e.event_date, u.name AS planner_name, u.email AS planner_email, u.phone AS planner_phone,
            v.business_name
     ${base} ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ total, page_size: PAGE, rows });
});

const TX_SQL = `SELECT t.id, t.reference, t.amount, t.status, t.points_earned, t.created_at,
       u.name AS planner_name, u.email AS planner_email, v.business_name, e.title AS event_title
  FROM transactions t JOIN users u ON u.id=t.user_id
  LEFT JOIN bookings b ON b.id=t.booking_id LEFT JOIN vendors v ON v.id=b.vendor_id LEFT JOIN events e ON e.id=b.event_id`;

router.get('/transactions', async (req, res) => {
  const where = req.query.status ? 'WHERE t.status=$1' : '';
  const params = req.query.status ? [req.query.status] : [];
  const total = (await query(`SELECT count(*)::int AS n FROM transactions t ${where}`, params)).rows[0].n;
  params.push(PAGE, page(req) * PAGE);
  const { rows } = await query(`${TX_SQL} ${where} ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ total, page_size: PAGE, rows });
});

// A cell starting with = + - or @ can run as a formula when the CSV is opened in Excel, so it gets a leading apostrophe.
const cell = (v) => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/transactions.csv', async (_req, res) => {
  const { rows } = await query(`${TX_SQL} ORDER BY t.created_at DESC LIMIT 10000`);
  const head = ['date', 'reference', 'amount_naira', 'status', 'points', 'planner', 'planner_email', 'vendor', 'event'];
  const lines = rows.map((r) => [r.created_at, r.reference, r.amount, r.status, r.points_earned, r.planner_name, r.planner_email, r.business_name, r.event_title].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="lyf-payments.csv"');
  res.send([head.join(','), ...lines].join('\r\n'));
});

// ---- Moderation ----
router.get('/reviews', async (_req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at, v.business_name, u.name AS planner_name, u.email AS planner_email
     FROM reviews r JOIN vendors v ON v.id=r.vendor_id JOIN users u ON u.id=r.planner_id
     ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json(rows);
});

router.delete('/reviews/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM reviews WHERE id=$1 RETURNING vendor_id, rating, comment`,
      [req.params.id]
    );
    if (!del.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'That review was already removed.' });
    }
    const vendorId = del.rows[0].vendor_id;
    await client.query(
      `UPDATE vendors SET
         rating = COALESCE((SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE vendor_id=$1), 0),
         review_count = (SELECT count(*) FROM reviews WHERE vendor_id=$1)
       WHERE id=$1`,
      [vendorId]
    );
    await client.query('COMMIT');
    await audit(req, 'removed review', 'review', req.params.id, `${del.rows[0].rating} stars: ${String(del.rows[0].comment || '').slice(0, 120)}`);
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

router.get('/media', async (_req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.url, m.created_at, v.business_name
     FROM vendor_media m JOIN vendors v ON v.id=m.vendor_id ORDER BY m.created_at DESC LIMIT 60`
  );
  res.json(rows);
});

router.delete('/media/:id', async (req, res) => {
  const { rows } = await query(
    `DELETE FROM vendor_media m USING vendors v WHERE m.id=$1 AND v.id=m.vendor_id RETURNING m.storage_path, v.business_name`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'That item was already removed.' });
  await removeFile(rows[0].storage_path);
  await audit(req, 'removed portfolio item', 'media', req.params.id, rows[0].business_name);
  res.json({ ok: true });
});

router.get('/emails', async (_req, res) => {
  const { rows } = await query(`SELECT id, to_email, subject, kind, status, error, created_at FROM email_log ORDER BY created_at DESC LIMIT 50`);
  res.json(rows);
});

export default router;
