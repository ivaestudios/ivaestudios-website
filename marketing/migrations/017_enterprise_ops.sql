-- 017: operaciones enterprise — registro de errores del backend.
-- El catch global del router inserta aquí (best-effort, silencioso) y el cron
-- diario avisa a los admins si hubo errores en las últimas 24 h. Apply with:
--   wrangler d1 execute ivae-gallery-db --remote --file=marketing/migrations/017_enterprise_ops.sql

CREATE TABLE IF NOT EXISTS mkt_error_log (
  id          TEXT PRIMARY KEY,
  route       TEXT,
  method      TEXT,
  message     TEXT,
  user_id     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_error_log_created ON mkt_error_log(created_at);
