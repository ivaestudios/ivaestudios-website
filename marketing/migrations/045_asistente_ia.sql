-- 045 · Asistente de IA para CLIENTES (piloto, 30-oct-2026).
-- Pedido de Israel: "que el agente también le sirva a mis clientes de marketing,
-- para que los pueda ayudar cuando nosotros no estemos". Un chat dentro de la
-- app, por marca, que responde con los datos de SU marca y deja solicitudes al
-- equipo. Se enciende marca por marca (asistente_ia = 1); apagado por defecto.
-- Backend: functions/api/marketing/_asistente.js · Vista: js/views/asistente.js

ALTER TABLE mkt_clients ADD COLUMN asistente_ia INTEGER NOT NULL DEFAULT 0;

-- Conversación por persona y marca (se le mandan al modelo los últimos 24).
CREATE TABLE IF NOT EXISTS mkt_asistente_mensajes (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  rol          TEXT NOT NULL CHECK (rol IN ('usuario','asistente')),
  texto        TEXT NOT NULL,
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  herramientas TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_asistente_msgs ON mkt_asistente_mensajes(client_id, user_id, created_at);

-- Solicitudes al equipo (la ÚNICA escritura que hace el asistente).
CREATE TABLE IF NOT EXISTS mkt_asistente_solicitudes (
  id           TEXT PRIMARY KEY,
  folio        TEXT NOT NULL,
  client_id    TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  user_id      TEXT,
  user_nombre  TEXT,
  tipo         TEXT NOT NULL DEFAULT 'otro',
  texto        TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','atendida')),
  atendida_por TEXT,
  atendida_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_asistente_sol ON mkt_asistente_solicitudes(client_id, estado, created_at);

INSERT OR IGNORE INTO mkt_schema_migrations (name, applied_at) VALUES ('045_asistente_ia', datetime('now'));
