-- LLAMADAS GRABADAS desde el CRM (pedido de Sebas, SMILE NOW, 10-oct-2026).
-- Cada marca conecta su línea de Twilio; el agente marca desde la Bandeja,
-- la llamada se graba, el audio se guarda en R2 y Gemini la transcribe.
CREATE TABLE IF NOT EXISTS mkt_llamadas (
  id                   TEXT PRIMARY KEY,
  client_id            TEXT NOT NULL,
  conv_id              TEXT,
  user_id              TEXT,
  user_nombre          TEXT,
  direccion            TEXT NOT NULL DEFAULT 'saliente',
  numero_paciente      TEXT,
  numero_agente        TEXT,
  estado               TEXT NOT NULL DEFAULT 'iniciando',
  resultado            TEXT,
  resultado_por        TEXT,
  twilio_sid           TEXT,
  twilio_sid_paciente  TEXT,
  contestada_en        TEXT,
  terminada_en         TEXT,
  duracion_seg         INTEGER,
  grabacion_sid        TEXT,
  grabacion_key        TEXT,
  grabacion_seg        INTEGER,
  grabacion_bytes      INTEGER,
  buzon                INTEGER NOT NULL DEFAULT 0,
  transcripcion        TEXT,
  transcripcion_estado TEXT,
  transcripcion_error  TEXT,
  procesando_desde     TEXT,
  intentos             INTEGER NOT NULL DEFAULT 0,
  evento_id            TEXT,
  nota                 TEXT,
  error                TEXT,
  creado               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  actualizado          TEXT
);
CREATE INDEX IF NOT EXISTS idx_mkt_llamadas_conv ON mkt_llamadas (conv_id, creado);
CREATE INDEX IF NOT EXISTS idx_mkt_llamadas_client ON mkt_llamadas (client_id, creado);
CREATE INDEX IF NOT EXISTS idx_mkt_llamadas_sid ON mkt_llamadas (twilio_sid);
CREATE INDEX IF NOT EXISTS idx_mkt_llamadas_trans ON mkt_llamadas (transcripcion_estado);
ALTER TABLE mkt_clients ADD COLUMN tw_account_sid TEXT;
ALTER TABLE mkt_clients ADD COLUMN tw_auth_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN tw_numero TEXT;
ALTER TABLE mkt_clients ADD COLUMN tw_numero_sid TEXT;
ALTER TABLE mkt_clients ADD COLUMN tw_connected_at TEXT;
ALTER TABLE mkt_users ADD COLUMN telefono TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN telefono TEXT;
