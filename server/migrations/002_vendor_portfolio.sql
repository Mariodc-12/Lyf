-- Vendor portfolio (photos and videos). Run once in the Supabase SQL Editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS vendor_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_media_vendor ON vendor_media(vendor_id, created_at DESC);

ALTER TABLE vendor_media ENABLE ROW LEVEL SECURITY;
