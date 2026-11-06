-- 046 · ADMINISTRACIÓN del estudio (5-nov-2026).
-- Pedido de Vianey: "un sistema de administración… checar las pautas… cuántos
-- leads tenemos en pauta y cuántos en SEO… el costo por sesión ya cerrada, el
-- costo de pauta y el ticket promedio". Solo admin, solo IVAE STUDIOS.
-- Backend: functions/api/marketing/_negocio.js · Vista: js/views/administracion.js

-- Sesiones cerradas (ventas). Las reservas de Juan entran solas (reserva_id
-- 'juan:<id>'); las demás se anotan a mano. precio en USD.
CREATE TABLE IF NOT EXISTS mkt_neg_ventas (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL,
  fecha        TEXT NOT NULL,              -- día en que se cerró (AAAA-MM-DD, Cancún)
  fecha_sesion TEXT,                       -- día de la sesión, si se sabe
  cliente      TEXT,
  paquete      TEXT,
  precio       REAL,                       -- USD
  fuente       TEXT,                       -- NULL = se deduce del lead
  estado       TEXT NOT NULL DEFAULT 'cerrada' CHECK (estado IN ('cerrada','cancelada','no_cuenta')),
  reserva_id   TEXT UNIQUE,
  conv_id      TEXT,
  notas        TEXT,
  creado_por   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_neg_ventas ON mkt_neg_ventas(client_id, fecha);

-- Leads: la fuente que Vianey corrige de una conversación de la Bandeja
-- (conv_id) o un lead que llegó por fuera (WhatsApp 990, llamada) y se anota a mano.
CREATE TABLE IF NOT EXISTS mkt_neg_leads (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL,
  conv_id      TEXT UNIQUE,
  fecha        TEXT,                       -- solo los de a mano (AAAA-MM-DD, Cancún)
  nombre       TEXT,
  canal        TEXT,
  fuente       TEXT NOT NULL,
  notas        TEXT,
  creado_por   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_neg_leads ON mkt_neg_leads(client_id, fecha);

INSERT OR IGNORE INTO mkt_schema_migrations (name, applied_at) VALUES ('046_negocio', datetime('now'));
