-- 047 · CONTROL DE MESES en Administración (6-nov-2026).
-- Vianey mandó su Excel "CONTROL DE MESES": por mes, lo que pagó cada cliente
-- (sesión, upgrade, propina) y lo de las cinco empresas de marketing, con la
-- forma de pago. Las ventas del panel pasan a guardar eso mismo:
--   tipo        sesion | upgrade | propina | marca | otro
--   monto_mxn   lo que entró en pesos (lo que ella anota); precio sigue en USD
--   forma_pago  stripe | bbva | efectivo | otro
--   empresa     para tipo 'marca': Regeneris, Divina Start Productions, Smile Now, Melisa, Adagio
-- Los gastos fijos, la ofrenda y el SAT viven en mkt_kv.negocio_cfg.

ALTER TABLE mkt_neg_ventas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'sesion';
ALTER TABLE mkt_neg_ventas ADD COLUMN monto_mxn REAL;
ALTER TABLE mkt_neg_ventas ADD COLUMN forma_pago TEXT;
ALTER TABLE mkt_neg_ventas ADD COLUMN empresa TEXT;

INSERT OR IGNORE INTO mkt_schema_migrations (name, applied_at) VALUES ('047_negocio_ingresos', datetime('now'));
