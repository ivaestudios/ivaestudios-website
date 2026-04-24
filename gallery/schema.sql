-- IVAE Gallery — Database Schema

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password       TEXT NOT NULL DEFAULT '',
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  auth_provider  TEXT DEFAULT 'email',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS password_resets (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS galleries (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title            TEXT NOT NULL,
  description      TEXT,
  cover_key        TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  session_date     TEXT,
  cover_design     TEXT DEFAULT 'classic',
  bg_color         TEXT DEFAULT '#ffffff',
  txt_color        TEXT DEFAULT '#1c1c1c',
  focal_x          REAL DEFAULT 50,
  focal_y          REAL DEFAULT 50,
  occasion         TEXT DEFAULT 'general',
  is_private       INTEGER DEFAULT 1,
  expire_enabled   INTEGER DEFAULT 0,
  expire_date      TEXT DEFAULT NULL,
  allow_sharing    INTEGER DEFAULT 1,
  allow_download   INTEGER DEFAULT 0,
  download_quality TEXT DEFAULT 'high',
  watermark_enabled INTEGER DEFAULT 1,
  watermark_opacity REAL    DEFAULT 0.3,
  watermark_text    TEXT    DEFAULT 'IVAE',
  watermark_subtext TEXT    DEFAULT 'STUDIOS',
  logo_key          TEXT    DEFAULT NULL,
  logo_white        INTEGER DEFAULT 0,
  proofing_enabled  INTEGER DEFAULT 0,
  proofing_target   INTEGER DEFAULT 30,
  proofing_message  TEXT    DEFAULT NULL,
  proofing_locked   INTEGER DEFAULT 0,
  expire_warned_at  TEXT    DEFAULT NULL,
  slideshow_speed_ms INTEGER DEFAULT 4000,
  slideshow_music_key TEXT  DEFAULT NULL,
  request_email    INTEGER DEFAULT 0,
  gallery_style    TEXT DEFAULT 'default',
  security_policy  TEXT DEFAULT 'normal',
  show_on_portfolio INTEGER DEFAULT 1,
  client_can_add   INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gallery_access (
  gallery_id      TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_password TEXT DEFAULT NULL,
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (gallery_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gallery_access_user ON gallery_access(user_id);

CREATE TABLE IF NOT EXISTS photos (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  gallery_id  TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  r2_key      TEXT NOT NULL UNIQUE,
  thumb_key   TEXT,
  web_key     TEXT,
  width       INTEGER,
  height      INTEGER,
  size_bytes  INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  scene_id    TEXT DEFAULT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_gallery ON photos(gallery_id, sort_order);

CREATE TABLE IF NOT EXISTS scenes (
  id          TEXT PRIMARY KEY,
  gallery_id  TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Photos',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS selections (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id    TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  selected_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_selections_user ON selections(user_id);
CREATE INDEX IF NOT EXISTS idx_selections_photo ON selections(photo_id);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS visitor_log (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  gallery_id    TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT,
  ip            TEXT,
  user_agent    TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visitor_log_gallery ON visitor_log(gallery_id);
CREATE INDEX IF NOT EXISTS idx_visitor_log_email ON visitor_log(email);

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
