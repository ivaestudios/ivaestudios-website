-- 049: EL FLUJO COMPLETO DEL ESTUDIO, VINCULADO (2026-11-06)
--
-- Vianey: "necesito que todo el flujo esté súper vinculado… incluso Stripe".
-- Primer contacto → seguimiento → sesión reservada → se paga el día de la
-- sesión (Stripe o efectivo) → 1 a 3 días hábiles para la galería de selección
-- → la clienta elige → post-producción (+ upgrade) → entrega.
--
-- · La etapa 'cliente' del Embudo se parte en FASES (solo el estudio; la
--   clínica no las usa): por_cobrar | en_proceso | eligiendo | postpro | entregada.
-- · galeria_id: su galería de IVAE Gallery (tabla galleries, misma base).
-- · mkt_cobros_conv: de quién es cada cobro de Stripe (cobros_sesion, migración
--   029 de la galería). La pone el sistema al reconocerla o Vianey a mano.
-- · mkt_neg_ventas.cobro_id: el ingreso que salió de ese cobro (no se duplica).

ALTER TABLE mkt_conversaciones ADD COLUMN fase TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN fase_en TEXT;
ALTER TABLE mkt_conversaciones ADD COLUMN galeria_id TEXT;

CREATE TABLE IF NOT EXISTS mkt_cobros_conv (
  cobro_id  TEXT PRIMARY KEY,                 -- cs_… (cobros_sesion.id)
  conv_id   TEXT NOT NULL,                    -- mkt_conversaciones.id
  manual    INTEGER NOT NULL DEFAULT 0,       -- 1 = lo amarró una persona (el sistema ya no lo mueve)
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cobros_conv_conv ON mkt_cobros_conv(conv_id);

ALTER TABLE mkt_neg_ventas ADD COLUMN cobro_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_neg_ventas_cobro ON mkt_neg_ventas(cobro_id);
-- La conversación de ese ingreso (pago en efectivo desde el Embudo, o reconocido):
-- la columna conv_id ya existe desde la 046; aquí solo su índice.
CREATE INDEX IF NOT EXISTS idx_neg_ventas_conv ON mkt_neg_ventas(conv_id);
