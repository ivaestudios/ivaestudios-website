-- 009: conexión de Instagram por marca (Graph API) + caché de métricas.
ALTER TABLE mkt_clients ADD COLUMN ig_user_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN ig_username TEXT;
ALTER TABLE mkt_clients ADD COLUMN ig_access_token TEXT;
CREATE TABLE IF NOT EXISTS mkt_ig_metrics (
  client_id   TEXT PRIMARY KEY REFERENCES mkt_clients(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
