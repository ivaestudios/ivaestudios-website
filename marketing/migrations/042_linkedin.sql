-- 042 — LinkedIn (2026-10-09)
-- Conexión por marca: perfil de la persona (OpenID + w_member_social) y, cuando
-- LinkedIn apruebe Community Management, la página de empresa.
-- El access token dura 60 días; refresh sólo para socios MDP (puede ir NULL).
ALTER TABLE mkt_clients ADD COLUMN li_person_urn TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_person_name TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_org_urn TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_org_name TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_access_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_refresh_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_access_expires_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_refresh_expires_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_scopes TEXT;
ALTER TABLE mkt_clients ADD COLUMN li_connected_at TEXT;
-- Por pieza: opt-in + destino (perfil|pagina) + rastro
ALTER TABLE mkt_posts ADD COLUMN also_linkedin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mkt_posts ADD COLUMN li_post_id TEXT;
ALTER TABLE mkt_posts ADD COLUMN li_error TEXT;
ALTER TABLE mkt_posts ADD COLUMN li_options TEXT;
