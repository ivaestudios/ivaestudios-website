-- 006: link mágico de cliente (acceso sin contraseña, token rotable).
-- El staff genera/rota el token por marca; GET /api/marketing/share/<token>
-- inicia sesión como el usuario cliente de esa marca y redirige a la app.
ALTER TABLE mkt_clients ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_clients_share_token
  ON mkt_clients(share_token) WHERE share_token IS NOT NULL;
