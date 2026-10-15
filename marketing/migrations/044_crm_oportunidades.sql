-- 044 — CRM de la Bandeja: embudo, oportunidades y tareas (2026-10-15).
--
-- Pedido de SMILE NOW (Sebastián, vía Israel): "algo así que muestre en cuál
-- etapa están" (el tablero por etapas de su CRM actual) y "en cada oportunidad
-- tengamos los campos para documentar planes de tratamiento, se registren los
-- puntos de contacto y deje generar tareas".
--
-- Lo que se agrega (todo aditivo, el código anterior sigue funcionando):
--   · Cada conversación ES la oportunidad: valor estimado y moneda, plan de
--     tratamiento (JSON con partidas), fecha de la cita, motivo de pérdida,
--     correo y desde cuándo está en su etapa.
--   · Tareas por oportunidad: qué hay que hacer, para cuándo, quién. El cron de
--     15 min avisa al teléfono del responsable cuando se vence.
--   · Los cambios (etapa, plan, cita, tareas, comentarios) quedan como eventos
--     en mkt_bandeja_eventos: son el historial de puntos de contacto.

ALTER TABLE mkt_conversaciones ADD COLUMN valor_estimado REAL;            -- monto de la oportunidad
ALTER TABLE mkt_conversaciones ADD COLUMN moneda TEXT;                    -- 'MXN' | 'USD' (NULL = MXN)
ALTER TABLE mkt_conversaciones ADD COLUMN plan_tratamiento TEXT;          -- JSON {items:[{id,tratamiento,detalle,precio,estado}], notas}
ALTER TABLE mkt_conversaciones ADD COLUMN fecha_cita TEXT;                -- 'AAAA-MM-DD HH:MM' hora de Cancún
ALTER TABLE mkt_conversaciones ADD COLUMN motivo_perdida TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN correo TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN etapa_en TEXT;                  -- UTC: cuándo entró a su etapa actual

CREATE TABLE IF NOT EXISTS mkt_bandeja_tareas (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL,
  conv_id           TEXT NOT NULL,
  titulo            TEXT NOT NULL,
  tipo              TEXT NOT NULL DEFAULT 'seguimiento',                  -- llamada | mensaje | cita | seguimiento
  vence_en          TEXT,                                                  -- UTC 'AAAA-MM-DD HH:MM:SS'
  asignado_a        TEXT,                                                  -- mkt_users.id
  asignado_nombre   TEXT,
  estado            TEXT NOT NULL DEFAULT 'pendiente',                    -- pendiente | hecha
  notas             TEXT,
  creado_por        TEXT,
  creado_por_nombre TEXT,
  creado            TEXT NOT NULL DEFAULT (datetime('now')),
  hecha_en          TEXT,
  hecha_por_nombre  TEXT,
  avisada           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bj_tareas_conv ON mkt_bandeja_tareas (conv_id, estado);
CREATE INDEX IF NOT EXISTS idx_bj_tareas_cliente ON mkt_bandeja_tareas (client_id, estado, vence_en);
CREATE INDEX IF NOT EXISTS idx_bj_tareas_aviso ON mkt_bandeja_tareas (estado, avisada, vence_en);
CREATE INDEX IF NOT EXISTS idx_bj_conv_etapa ON mkt_conversaciones (client_id, archivado, etapa);
