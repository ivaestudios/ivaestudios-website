-- ============================================================================
-- IVAE Marketing — migración 014: estado OAuth del conector MCP de Claude.ai.
--
-- claude.ai exige OAuth para conectores personalizados. Esta tabla guarda el
-- estado del flujo (clave-valor por tipo):
--   kind='client'   id=<client_id>   data={redirect_uris,...}     (registro DCR)
--   kind='code'     id=<auth_code>   data={code_challenge,...}    (10 min)
--   kind='token'    id=<access_token>                             (90 días)
--   kind='refresh'  id=<refresh_token>                            (1 año)
--   kind='config'   id='password'    data={hash}                  (clave del conector)
--
-- Aplicar:
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/014_mcp_oauth.sql"
-- ============================================================================

CREATE TABLE IF NOT EXISTS mkt_mcp_oauth (
  kind        TEXT NOT NULL,
  id          TEXT NOT NULL,
  data        TEXT,
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS idx_mkt_mcp_oauth_exp ON mkt_mcp_oauth(expires_at);
