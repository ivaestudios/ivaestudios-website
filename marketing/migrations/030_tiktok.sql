-- 030 — TikTok (2026-08-17)
-- Conexión por marca (access 24h + refresh 365d CON rotación)
ALTER TABLE mkt_clients ADD COLUMN tt_open_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN tt_username TEXT;
ALTER TABLE mkt_clients ADD COLUMN tt_access_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN tt_refresh_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN tt_access_expires_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN tt_refresh_expires_at TEXT;
-- Por pieza: opt-in + rastro
ALTER TABLE mkt_posts ADD COLUMN also_tiktok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mkt_posts ADD COLUMN tt_post_id TEXT;
ALTER TABLE mkt_posts ADD COLUMN tt_error TEXT;
