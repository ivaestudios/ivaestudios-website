-- IVAE Marketing — Content Calendar app schema
-- Lives in the SAME D1 database as the gallery (binding `DB` → ivae-gallery-db).
-- All tables are namespaced `mkt_*` so they never collide with gallery tables.
-- Auth is fully isolated from the gallery: separate users/sessions + a separate
-- `mkt_session` cookie. Apply with:
--   wrangler d1 execute ivae-gallery-db --remote --file=marketing/migrations/001_init.sql
-- ============================================================================

-- ── USERS (team + clients) ──
-- role: 'admin'  = owner (Vianey), full control
--       'team'   = staff (Jairo, Natalia, Misael...), manage all clients
--       'client' = external client, sees ONLY their own client_id calendar
CREATE TABLE IF NOT EXISTS mkt_users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password      TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin','team','client')),
  client_id     TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE, -- only for role='client'
  active        INTEGER NOT NULL DEFAULT 1,
  must_reset    INTEGER NOT NULL DEFAULT 0,  -- force password change on first login
  last_login    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_users_email  ON mkt_users(email);
CREATE INDEX IF NOT EXISTS idx_mkt_users_client ON mkt_users(client_id);

-- ── SESSIONS ──
CREATE TABLE IF NOT EXISTS mkt_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_sessions_user    ON mkt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_sessions_expires ON mkt_sessions(expires_at);

-- ── CLIENTS (each = one calendar / workspace) ──
CREATE TABLE IF NOT EXISTS mkt_clients (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  brand_color       TEXT DEFAULT '#7c3aed',   -- accent shown in the UI per client
  logo_url          TEXT,
  instagram_handle  TEXT,
  timezone          TEXT DEFAULT 'America/Cancun',
  notes             TEXT,
  archived          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_clients_archived ON mkt_clients(archived);

-- ── POSTS (the content rows; one per planned piece of content) ──
-- status pipeline: idea → guion → grabacion → edicion → revision → aprobado → programado → publicado
-- content_type: reel | tiktok | informativo | carrusel | experiencia | pauta | tratamientos | historia | foto
CREATE TABLE IF NOT EXISTS mkt_posts (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id     TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Nuevo contenido',
  content_type  TEXT NOT NULL DEFAULT 'reel',
  grabacion     INTEGER,                         -- recording priority 1-5 (nullable)
  publish_date  TEXT,                            -- YYYY-MM-DD (nullable = unscheduled / backlog)
  assignee      TEXT,                            -- "hecho por" — free text or member name
  platform      TEXT DEFAULT 'Instagram',
  status        TEXT NOT NULL DEFAULT 'idea',
  caption       TEXT,
  inspo_url     TEXT,
  video_url     TEXT,                            -- final video / asset link
  hook          TEXT,                            -- script: HOOK
  body          TEXT,                            -- script: BODY
  cta           TEXT,                            -- script: CTA
  hashtags      TEXT,
  notes_team    TEXT,                            -- internal notes (not shown in client portal)
  client_visible INTEGER NOT NULL DEFAULT 1,     -- show this post in the client portal?
  approval_state TEXT NOT NULL DEFAULT 'pending' CHECK (approval_state IN ('pending','approved','changes')),
  position      INTEGER NOT NULL DEFAULT 0,      -- ordering within a status column / day
  created_by    TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_client  ON mkt_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_date     ON mkt_posts(client_id, publish_date);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_status   ON mkt_posts(client_id, status);

-- ── COMMENTS (threaded notes per post; visible to team always, clients see non-internal) ──
CREATE TABLE IF NOT EXISTS mkt_comments (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id      TEXT NOT NULL REFERENCES mkt_posts(id) ON DELETE CASCADE,
  user_id      TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL,
  author_role  TEXT NOT NULL DEFAULT 'team',
  body         TEXT NOT NULL,
  internal     INTEGER NOT NULL DEFAULT 0,       -- 1 = team-only, hidden from client portal
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_comments_post ON mkt_comments(post_id);

-- ── APPROVALS (audit trail of client approve / request-changes decisions) ──
CREATE TABLE IF NOT EXISTS mkt_approvals (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id     TEXT NOT NULL REFERENCES mkt_posts(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  actor_name  TEXT NOT NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('approved','changes')),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_approvals_post ON mkt_approvals(post_id);

-- ── ACTIVITY (enterprise audit log) ──
CREATE TABLE IF NOT EXISTS mkt_activity (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id   TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,
  post_id     TEXT,
  user_id     TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,                     -- e.g. 'post.create','post.update','post.approve','status.change'
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_activity_client ON mkt_activity(client_id, created_at);
