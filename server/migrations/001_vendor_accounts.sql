-- Vendor accounts. Run once in the Supabase SQL Editor on an existing Lyf database.
-- Safe to run more than once.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'planner';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('planner','vendor'));

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_owner ON vendors(owner_user_id) WHERE owner_user_id IS NOT NULL;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_note TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('requested','confirmed','declined','deposit_paid','completed','cancelled'));
