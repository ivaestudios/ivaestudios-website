-- ============================================================================
-- IVAE Marketing — migración 013: claves del conector MCP para Claude.ai.
--
-- Cada fila = una "capability URL" que se pega en claude.ai (Configuración ->
-- Conectores) como https://ivaestudios.com/api/mcp/<token>.
--
--   token      : el secreto que va en la ruta (>= 32 chars). PK + UNIQUE.
--   client_id  : si está presente, la clave queda FIJADA a esa marca (el
--                conector solo puede leer/crear en ella). NULL = clave global
--                (uso interno del equipo: opera cualquier marca vía argumento).
--   revoked    : 1 = inutilizada (getKey la ignora).
--
-- Aplicar:
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/013_mcp_keys.sql"
-- ============================================================================

CREATE TABLE IF NOT EXISTS mkt_mcp_keys (
  token       TEXT PRIMARY KEY CHECK (length(token) >= 32),
  client_id   TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,  -- NULL = clave global
  label       TEXT,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_mcp_keys_client ON mkt_mcp_keys(client_id);
