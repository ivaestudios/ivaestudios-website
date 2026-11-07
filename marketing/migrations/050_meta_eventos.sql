-- 050 · Lo que le avisamos a Meta (Conversions API): quién reservó y quién pagó.
-- Una fila por persona y evento; si se reintenta, se actualiza la misma fila.
CREATE TABLE IF NOT EXISTS mkt_meta_eventos (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  evento TEXT NOT NULL,            -- Schedule | Purchase
  event_id TEXT NOT NULL,
  valor_mxn REAL,
  enviado_en TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  respuesta TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_eventos_conv ON mkt_meta_eventos (conv_id, evento);
CREATE INDEX IF NOT EXISTS idx_meta_eventos_client ON mkt_meta_eventos (client_id, enviado_en);
