-- ============================================================================
-- IVAE Marketing — migración 037: el conector MCP se aísla POR AGENCIA.
--
-- Antes: una llave sin client_id era "global" y veía TODAS las marcas de la
-- base. Con varias agencias dentro de la app eso significa que el Claude (o
-- el ChatGPT) de una agencia podía leer y escribir el calendario de otra.
-- Ahora TODA llave pertenece a un workspace y jamás sale de él.
--
--   mkt_mcp_keys.workspace_id : la agencia dueña de la llave (default 'ivae').
--   mkt_mcp_pass              : la CLAVE del conector (pantalla OAuth), una
--                               por agencia; se guarda solo el hash SHA-256.
--
-- Aplicar:
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/037_mcp_workspace.sql"
-- ============================================================================

ALTER TABLE mkt_mcp_keys ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'ivae';

-- Las llaves fijadas a una marca heredan el workspace de esa marca.
UPDATE mkt_mcp_keys
   SET workspace_id = COALESCE(
         (SELECT COALESCE(c.workspace_id, 'ivae') FROM mkt_clients c WHERE c.id = mkt_mcp_keys.client_id),
         'ivae')
 WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_mcp_keys_ws ON mkt_mcp_keys(workspace_id);

CREATE TABLE IF NOT EXISTS mkt_mcp_pass (
  hash         TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  label        TEXT,
  revoked      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_mcp_pass_ws ON mkt_mcp_pass(workspace_id);

-- La clave que ya existía (mkt_mcp_oauth kind=config id=password) queda como
-- la de IVAE, para no romper el conector que ya está conectado.
INSERT OR IGNORE INTO mkt_mcp_pass (hash, workspace_id, label)
SELECT json_extract(data, '$.hash'), 'ivae', 'IVAE (clave original)'
  FROM mkt_mcp_oauth
 WHERE kind = 'config' AND id = 'password' AND json_extract(data, '$.hash') IS NOT NULL;
