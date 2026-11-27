import pg from 'pg';
import 'dotenv/config';

const useSsl = /supabase\.(co|com)/.test(process.env.DATABASE_URL || '');
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Supabase closes idle connections. Without this handler, Node treats that as
// an uncaught error and shuts the whole server down.
pool.on('error', (err) => {
  console.error('Database connection dropped, a new one will open on the next request:', err.message);
});

export const query = (text, params) => pool.query(text, params);
