-- 029 — Páginas de Facebook (2026-08-17)
-- Página conectada por marca (token de página de larga duración: NO caduca)
ALTER TABLE mkt_clients ADD COLUMN fb_page_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN fb_page_name TEXT;
ALTER TABLE mkt_clients ADD COLUMN fb_access_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN fb_connected_at TEXT;
-- Por pieza: opt-in a doble publicación + rastro de Facebook
ALTER TABLE mkt_posts ADD COLUMN also_facebook INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mkt_posts ADD COLUMN fb_post_id TEXT;
ALTER TABLE mkt_posts ADD COLUMN fb_error TEXT;
