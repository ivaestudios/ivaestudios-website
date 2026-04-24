-- Migration 004 — Studio settings (singleton row) + gallery_events for analytics
-- Singleton row id='studio'. Stores brand defaults, watermark defaults,
-- contact info, social links, storage limits — applied across the app.

CREATE TABLE IF NOT EXISTS studio_settings (
  id                       TEXT PRIMARY KEY DEFAULT 'studio',
  -- Identity
  studio_name              TEXT NOT NULL DEFAULT 'IVAE Studios',
  tagline                  TEXT DEFAULT 'Luxury Resort Photography · Cancún',
  contact_email            TEXT DEFAULT 'gallery@ivaestudios.com',
  contact_phone            TEXT DEFAULT '',
  website_url              TEXT DEFAULT 'https://ivaestudios.com',
  -- Brand defaults (also seeds new galleries)
  brand_primary            TEXT DEFAULT '#1c1c1c',   -- ink
  brand_accent             TEXT DEFAULT '#c9a96e',   -- gold
  brand_bg                 TEXT DEFAULT '#fdfaf3',   -- cream
  brand_logo_key           TEXT DEFAULT NULL,        -- R2 key for studio-wide logo
  brand_font_serif         TEXT DEFAULT 'Cormorant Garamond',
  brand_font_sans          TEXT DEFAULT 'Syne',
  -- Watermark defaults
  default_watermark_enabled INTEGER DEFAULT 1,
  default_watermark_text    TEXT DEFAULT 'IVAE',
  default_watermark_subtext TEXT DEFAULT 'STUDIOS',
  default_watermark_opacity REAL DEFAULT 0.3,
  -- Email / notification defaults
  default_from_name         TEXT DEFAULT 'IVAE Studios',
  default_signature         TEXT DEFAULT 'IVAE Studios — Cancún',
  notify_admin_on_proof     INTEGER DEFAULT 1,
  notify_admin_on_visit     INTEGER DEFAULT 0,
  -- Storage / plan
  storage_limit_gb          INTEGER DEFAULT 10,
  -- Gallery defaults applied to new galleries
  default_expire_days       INTEGER DEFAULT 90,      -- auto expire 90 days after publish
  default_request_email     INTEGER DEFAULT 1,       -- email gate ON by default
  default_allow_download    INTEGER DEFAULT 0,
  default_allow_sharing     INTEGER DEFAULT 1,
  -- Social / portfolio
  instagram_handle          TEXT DEFAULT '',
  pinterest_url             TEXT DEFAULT '',
  -- Timestamps
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed the singleton row so PUT can simply UPDATE.
INSERT OR IGNORE INTO studio_settings (id) VALUES ('studio');

-- Lightweight event log for Phase-2 analytics. Each row is one client action.
-- Kept narrow on purpose: gallery_id + event_type + visitor identity + ts.
CREATE TABLE IF NOT EXISTS gallery_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id   TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,        -- view, photo_view, favorite, unfavorite, download, share, slideshow, proof_submit
  visitor_id   TEXT,                 -- pic_visit cookie or session user id
  visitor_email TEXT,
  photo_id     TEXT,                 -- nullable; only for photo-scoped events
  meta         TEXT,                 -- JSON for extra context
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gallery_events_gallery_time ON gallery_events(gallery_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_events_type_time ON gallery_events(event_type, occurred_at DESC);
