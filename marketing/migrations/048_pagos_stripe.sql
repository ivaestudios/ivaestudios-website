-- 048 · LINKS DE PAGO DE STRIPE (6-nov-2026). Israel: "Juan me ayude a generar links de pago…
-- acceso a Stripe solo para crear links y para leer".
-- Los crea el Worker de Juan (ivae-juan) con una llave RESTRINGIDA de Stripe, desde la Bandeja
-- (botón Cobrar) o desde el chat de Israel (Viernes). Los PAGOS no viven aquí: los guarda la
-- galería en cobros_sesion (migración 029 de ivae-gallery, misma base) y el sistema de marketing
-- los amarra a su clienta (mkt_cobros_conv, 048_flujo_estudio) y a la venta (mkt_neg_ventas.cobro_id).
-- Cuando un cobro trae payment_link = uno de estos links, Juan lo marca pagado y deja la liga.
CREATE TABLE IF NOT EXISTS mkt_pago_links (
  id           TEXT PRIMARY KEY,            -- plink_… de Stripe
  client_id    TEXT NOT NULL,
  url          TEXT NOT NULL,               -- buy.stripe.com/… (+ correo prellenado)
  monto        REAL NOT NULL,
  moneda       TEXT NOT NULL,               -- usd | mxn
  concepto     TEXT,
  tipo         TEXT NOT NULL DEFAULT 'sesion',  -- sesion | upgrade | propina | otro
  cliente      TEXT,
  correo       TEXT,
  telefono     TEXT,
  conv_id      TEXT,                        -- chat de la Bandeja, si se creó desde ahí
  canal        TEXT,
  contacto_id  TEXT,
  reserva_id   TEXT,                        -- id de la reserva de Juan (carta_jobs), si salió de una
  paquete      TEXT,
  origen       TEXT,                        -- crm | viernes
  creado_por   TEXT,
  estado       TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | pagado | desactivado
  pagado_en    TEXT,
  pago_id      TEXT,                        -- cobros_sesion.id (cs_…) cuando se pagó
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pago_links_cliente ON mkt_pago_links (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pago_links_conv ON mkt_pago_links (conv_id);
CREATE INDEX IF NOT EXISTS idx_pago_links_contacto ON mkt_pago_links (contacto_id);

INSERT OR IGNORE INTO mkt_schema_migrations (name, applied_at) VALUES ('048_pagos_stripe', datetime('now'));
