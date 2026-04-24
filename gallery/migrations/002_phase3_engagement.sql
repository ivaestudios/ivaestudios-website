-- Phase 3 — Engagement: email gate, proofing, expiry warnings
-- Adds: visitor pre-registration log, client selection submissions,
--       per-gallery proofing config + expiry-warning bookkeeping

-- Track every visitor who entered email at the gate.
-- Used for: photographer's lead list, automatic notifications,
-- and to know when to re-prompt for email (expired cookie / new device).
CREATE TABLE IF NOT EXISTS visitor_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  gallery_id   TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT,
  ip           TEXT,
  user_agent   TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visitor_log_gallery ON visitor_log(gallery_id);
CREATE INDEX IF NOT EXISTS idx_visitor_log_email ON visitor_log(email);

-- Client-submitted final selections (proofing workflow).
-- One row per submission; photo_ids is JSON array of photo IDs the client picked.
CREATE TABLE IF NOT EXISTS proof_submissions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  gallery_id   TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT,
  photo_ids    TEXT NOT NULL,
  note         TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'completed'))
);
CREATE INDEX IF NOT EXISTS idx_proof_submissions_gallery ON proof_submissions(gallery_id);

-- Gallery-level proofing config + expiry-warning bookkeeping
ALTER TABLE galleries ADD COLUMN proofing_enabled  INTEGER DEFAULT 0;
ALTER TABLE galleries ADD COLUMN proofing_target   INTEGER DEFAULT 30;
ALTER TABLE galleries ADD COLUMN proofing_message  TEXT DEFAULT NULL;
ALTER TABLE galleries ADD COLUMN proofing_locked   INTEGER DEFAULT 0;
ALTER TABLE galleries ADD COLUMN expire_warned_at  TEXT DEFAULT NULL;
ALTER TABLE galleries ADD COLUMN slideshow_speed_ms INTEGER DEFAULT 4000;
ALTER TABLE galleries ADD COLUMN slideshow_music_key TEXT DEFAULT NULL;
