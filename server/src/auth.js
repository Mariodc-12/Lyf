import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  let id;
  try {
    id = jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
  // Checked on every request so a suspended account loses access straight away.
  const { rows } = await query('SELECT role, status FROM users WHERE id=$1', [id]);
  if (!rows.length) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  if (rows[0].status === 'suspended') return res.status(403).json({ error: SUSPENDED_MESSAGE });
  req.userId = id;
  req.role = rows[0].role;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'This area is for admins.' });
  next();
}

export const SUSPENDED_MESSAGE = 'This account has been suspended. Contact Lyf support.';

// Never send password hashes to the browser.
export function publicUser(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return { ...rest, has_password: !!password_hash };
}

// ---- Passwords (scrypt is built into Node, so there is nothing extra to install) ----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function checkPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Use at least 8 characters for your password.';
  if (p.length > 100) return 'Use fewer than 100 characters for your password.';
  return null;
}

export function normalizeEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
}

// ---- Simple in-memory attempt limiter (one server process). Move to Redis if you run several. ----
const attempts = new Map();
export function tooMany(key, max, windowMs) {
  const now = Date.now();
  const hits = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  attempts.set(key, hits);
  return hits.length >= max;
}
export function recordAttempt(key) {
  attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
}
export function clearAttempts(key) {
  attempts.delete(key);
}
setInterval(() => attempts.clear(), 6 * 60 * 60 * 1000).unref();

export function newResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  return null;
}

// ---- Emailed sign-in codes (hashed at rest, 10 minutes, 5 tries each) ----
export async function createLoginCode(email) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await query(`UPDATE login_codes SET used = true WHERE email = $1 AND NOT used`, [email]);
  await query(
    `INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1,$2, now() + interval '10 minutes')`,
    [email, hashToken(`${email}:${code}`)]
  );
  return code;
}

// Returns true once, for the newest unused, unexpired code, and only if the code is right.
export async function checkLoginCode(email, code) {
  const { rows } = await query(
    `SELECT id, code_hash, attempts FROM login_codes
     WHERE email=$1 AND NOT used AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (!rows.length) return false;
  if (rows[0].attempts >= 5) return false;
  if (rows[0].code_hash !== hashToken(`${email}:${String(code).trim()}`)) {
    await query(`UPDATE login_codes SET attempts = attempts + 1 WHERE id=$1`, [rows[0].id]);
    return false;
  }
  const done = await query(`UPDATE login_codes SET used = true WHERE id=$1 AND NOT used RETURNING id`, [rows[0].id]);
  return done.rows.length === 1;
}
