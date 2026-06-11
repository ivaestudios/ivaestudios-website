-- ============================================================
-- IVAE Marketing — migration 004: enterprise (notificaciones,
-- automatizaciones por recetas, checklist, plantillas, vistas
-- guardadas, capacidades, KV utilitaria, indices correctivos).
--
-- 100% IDEMPOTENTE y re-ejecutable: SOLO CREATE TABLE/INDEX IF
-- NOT EXISTS e INSERT OR IGNORE. CERO ALTER (los ALTER de
-- mkt_posts viven en 005_posts_v2_columns.sql, que se aplica
-- DESPUES de esta).
--
-- Aplicar (ruta con espacios: SIEMPRE entre comillas):
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/004_enterprise.sql"
-- ============================================================

-- ── Ledger de migraciones (nuevo; registra las previas ya aplicadas) ──
CREATE TABLE IF NOT EXISTS mkt_schema_migrations(
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES
  ('001_init'),
  ('002_seed_demo'),
  ('003_per_person_notes'),
  ('004_enterprise');

-- ── Notificaciones ──
-- body se RESUELVE al escribir (placeholders ya sustituidos: el historial
-- no cambia si renombran el post). client_id/post_id/comment_id SIN FK
-- (criterio mkt_activity: las filas sobreviven borrados).
CREATE TABLE IF NOT EXISTS mkt_notifications(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  client_id TEXT,
  post_id TEXT,
  comment_id TEXT,
  type TEXT NOT NULL,
  actor_name TEXT,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_notif_user ON mkt_notifications(user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_notif_created ON mkt_notifications(created_at);

-- ── Automatizaciones: 8 recetas fijas con toggle ──
-- El catalogo de frases vive en codigo (keys identicas back/front).
CREATE TABLE IF NOT EXISTS mkt_automations(
  recipe_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO mkt_automations(recipe_key, enabled, config) VALUES
  ('aprobado_mueve_estado', 1, '{}'),
  ('aviso_cambios', 1, '{}'),
  ('aviso_comentario', 1, '{}'),
  ('aviso_asignacion', 1, '{}'),
  ('recordatorio_publicacion', 1, '{"days_before":1}'),
  ('marcar_atrasado', 1, '{}'),
  ('aviso_revision_cliente', 1, '{}'),
  ('alerta_sin_aprobar', 1, '{}');

-- ── Dedupe de recetas de tiempo ──
-- run_key = '<recipe>:<post_id>:<YYYY-MM-DD>'; INSERT OR IGNORE y solo
-- notificar si inserto (una notificacion por post por dia, nunca spam).
CREATE TABLE IF NOT EXISTS mkt_automation_runs(
  run_key TEXT PRIMARY KEY,
  post_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Checklist interna por post (JAMAS viaja al portal cliente) ──
CREATE TABLE IF NOT EXISTS mkt_checklist_items(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id TEXT NOT NULL REFERENCES mkt_posts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  done_by TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_checklist_post ON mkt_checklist_items(post_id, position);

-- ── Plantillas custom por cliente ──
-- Las builtin viven en codigo; la tabla habilita v1.5 sin re-migrar.
CREATE TABLE IF NOT EXISTS mkt_templates(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'reel',
  config TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_client ON mkt_templates(client_id);

-- ── Vistas guardadas (persistencia confiable en D1) ──
CREATE TABLE IF NOT EXISTS mkt_saved_views(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'tabla',
  config TEXT NOT NULL DEFAULT '{}',
  is_shared INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_saved_views_user ON mkt_saved_views(user_id, position);
CREATE INDEX IF NOT EXISTS idx_mkt_saved_views_client ON mkt_saved_views(client_id, is_shared);

-- ── Capacidad semanal por persona (vista Carga) ──
CREATE TABLE IF NOT EXISTS mkt_capacities(
  assignee TEXT PRIMARY KEY COLLATE NOCASE,
  weekly_points INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── KV utilitaria ──
-- 'lazy_sweep_at' (throttle 15 min del sweep) y 'tz_offset'
-- (Cancun UTC-5 fijo, sin DST; formato de modificador SQLite).
CREATE TABLE IF NOT EXISTS mkt_kv(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO mkt_kv(key, value) VALUES ('tz_offset', '-300 minutes');

-- ── Indices correctivos (auditoria: full-scan de /activity, sweep
--    cross-cliente, N+1 de clientCounts) ──
CREATE INDEX IF NOT EXISTS idx_mkt_posts_publish ON mkt_posts(publish_date);
CREATE INDEX IF NOT EXISTS idx_mkt_activity_created ON mkt_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_activity_post ON mkt_activity(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_pending ON mkt_posts(client_id)
  WHERE approval_state IN ('pending','changes') AND client_visible = 1;
