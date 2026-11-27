import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Where uploaded files live.
//  - Without SUPABASE_URL and SUPABASE_SERVICE_KEY: the server's own disk (fine for development).
//  - With both set: a public Supabase Storage bucket (use this once the app is online,
//    because hosts like Render wipe the disk on every deploy).

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

const bucket = () => process.env.SUPABASE_BUCKET || 'portfolio';
const baseUrl = () => String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
export const usingSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key };
  // Older service_role keys are JWTs and go in Authorization too. Newer sb_secret_ keys only use apikey.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function saveFile({ buffer, ext, mime, vendorId }) {
  const name = `${vendorId}/${crypto.randomUUID()}.${ext}`;

  if (usingSupabase()) {
    const res = await fetch(`${baseUrl()}/storage/v1/object/${bucket()}/${name}`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Content-Type': mime },
      body: buffer,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Supabase Storage upload failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return { path: name, url: `${baseUrl()}/storage/v1/object/public/${bucket()}/${name}` };
  }

  const full = path.join(UPLOAD_DIR, name);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return { path: name, url: `/uploads/${name}` };
}

export async function removeFile(storagePath) {
  try {
    if (usingSupabase()) {
      await fetch(`${baseUrl()}/storage/v1/object/${bucket()}/${storagePath}`, {
        method: 'DELETE',
        headers: supabaseHeaders(),
      });
      return;
    }
    const full = path.resolve(UPLOAD_DIR, storagePath);
    if (full.startsWith(UPLOAD_DIR + path.sep)) await fs.unlink(full);
  } catch (e) {
    // The database row is the source of truth. A leftover file is harmless.
    console.error('Could not remove stored file:', e.message);
  }
}
