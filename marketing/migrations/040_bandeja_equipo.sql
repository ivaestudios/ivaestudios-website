-- 040 — Bandeja con equipo de ventas (2026-10-07, pedido de Israel para SMILE NOW).
--
-- Lo que se agrega:
--   · Agentes por marca: un acceso de cliente puede ser 'agente' (atiende los
--     chats que le tocan) o 'supervisor' (ve todo y el desempeño del equipo).
--   · Reparto parejo: cada conversación guarda a quién se le asignó y cuándo.
--   · Origen del lead: de qué anuncio llegó (Click to WhatsApp, Messenger o
--     Instagram) para medir leads y citas por anuncio.
--   · Entrega real de WhatsApp: la API contesta "aceptado" aunque luego el
--     mensaje no llegue (ventana de 24 h, pago, tope de marketing). El webhook
--     de estados actualiza cada mensaje a entregado, leído o no entregado.
--   · Plantilla abierta: cómo salió cada mensaje (texto libre o plantilla).
--   · Eventos del equipo (llamadas, asignaciones, cambios de etapa) para el
--     dashboard del dueño.

ALTER TABLE mkt_users ADD COLUMN bandeja_rol TEXT;                       -- NULL | 'agente' | 'supervisor'
ALTER TABLE mkt_users ADD COLUMN bandeja_disponible INTEGER NOT NULL DEFAULT 1;

ALTER TABLE mkt_conversaciones ADD COLUMN asignado_a TEXT;               -- mkt_users.id
ALTER TABLE mkt_conversaciones ADD COLUMN asignado_en TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN origen TEXT;                   -- JSON {tipo, ad_id, titulo, url, ctwa_clid}

ALTER TABLE mkt_mensajes ADD COLUMN via TEXT;                            -- NULL = texto libre | 'plantilla:<clave>'
ALTER TABLE mkt_mensajes ADD COLUMN entregado_en TEXT;
ALTER TABLE mkt_mensajes ADD COLUMN leido_en TEXT;

ALTER TABLE mkt_clients ADD COLUMN bandeja_cfg TEXT;                     -- JSON: reparto, reasignar_min, nombre_comercial, plantillas

CREATE TABLE IF NOT EXISTS mkt_bandeja_eventos (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL,
  conv_id    TEXT,
  user_id    TEXT,
  user_nombre TEXT,
  tipo       TEXT NOT NULL,                                              -- asignacion | reasignacion | tomada | llamada | etapa
  dato       TEXT,                                                       -- JSON con el detalle
  creado     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bj_eventos_cliente ON mkt_bandeja_eventos (client_id, creado);
CREATE INDEX IF NOT EXISTS idx_bj_eventos_conv ON mkt_bandeja_eventos (conv_id, creado);
CREATE INDEX IF NOT EXISTS idx_bj_conv_asignado ON mkt_conversaciones (client_id, asignado_a);
